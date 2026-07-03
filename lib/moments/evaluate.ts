import type { Widget } from "@/lib/schema";
import type { MomentTier } from "./bus";
import { parsePresetData, type PresetType } from "@/lib/schema/widget";

function pctDelta(prev: number, next: number): number {
  if (prev === 0) return next === 0 ? 0 : 100;
  return (Math.abs(next - prev) / Math.abs(prev)) * 100;
}

/**
 * Default moment triggers (§4.4): stat |Δ| ≥ 10% → t1, ≥ 25% → t2;
 * gauge crossing warn → t2, crit → t3. Returns t0 for silent morphs.
 */
export function evaluateMoment(widget: Widget, prevData: unknown, nextData: unknown): MomentTier {
  if (widget.type === "stat") {
    const prev = parsePresetData("stat", prevData);
    const next = { ...prev, ...(nextData as Record<string, unknown>) };
    const change = pctDelta(prev.value, next.value);
    const t1 = widget.thresholds?.t1 ?? 10;
    const t2 = widget.thresholds?.t2 ?? 25;
    if (change >= t2) return "t2";
    if (change >= t1) return "t1";
    return "t0";
  }

  if (widget.type === "gauge") {
    const prev = parsePresetData("gauge", prevData);
    const next = { ...prev, ...(nextData as object) };
    const { warn, crit } = prev;
    if (crit !== undefined && prev.value < crit && next.value >= crit) return "t3";
    if (warn !== undefined && prev.value < warn && next.value >= warn) return "t2";
    const change = pctDelta(prev.value, next.value);
    if (change >= 25) return "t2";
    if (change >= 10) return "t1";
    return "t0";
  }

  if (widget.type === "timeseries") {
    const prev = parsePresetData("timeseries", prevData);
    const next = { ...prev, ...(nextData as object) };
    const prevLast = prev.series.at(-1)?.v ?? 0;
    const nextLast = next.series.at(-1)?.v ?? prevLast;
    const change = pctDelta(prevLast, nextLast);
    if (change >= 25) return "t2";
    if (change >= 10) return "t1";
    return "t0";
  }

  if (widget.type === "statusGrid") {
    const prev = parsePresetData("statusGrid", prevData);
    const patch = nextData as { items?: typeof prev.items };
    const nextItems = patch.items ?? prev.items;
    const hadDown = prev.items.some((i) => i.state === "down");
    const hasDown = nextItems.some((i) => i.state === "down");
    if (!hadDown && hasDown) return "t3";
    if (hadDown && !hasDown) return "t2";
    return "t0";
  }

  return "t0";
}

export function isMetricWidget(type: Widget["type"]): type is PresetType {
  return type === "stat" || type === "gauge" || type === "timeseries" || type === "statusGrid";
}

/** Whether a widget's alert condition is still active (§4.4 sustained t3). */
export function hasActiveAlertCondition(widget: Widget, data: unknown): boolean {
  if (widget.type === "statusGrid") {
    const d = parsePresetData("statusGrid", data);
    return d.items.some((i) => i.state === "down");
  }
  if (widget.type === "gauge") {
    const d = parsePresetData("gauge", data);
    return d.crit !== undefined && d.value >= d.crit;
  }
  return false;
}
