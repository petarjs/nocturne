import type { Widget } from "@nocturne/core";
import type { MomentTier } from "./bus";
import { parsePresetData, type PresetType } from "@nocturne/core";

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

    // §4.4 default: a new point ≥ 3σ off the rolling window is an event (t2).
    const window = prev.series.map((p) => p.v);
    if (window.length >= 8) {
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
      const std = Math.sqrt(variance);
      if (std > 1e-6 && Math.abs(nextLast - mean) / std >= 3) return "t2";
    }

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

  if (widget.type === "barChart") {
    const prev = parsePresetData("barChart", prevData);
    const patch = nextData as { categories?: typeof prev.categories };
    const nextCategories = patch.categories ?? prev.categories;
    const prevTotal = prev.categories.reduce((a, c) => a + c.value, 0);
    const nextTotal = nextCategories.reduce((a, c) => a + c.value, 0);
    const change = pctDelta(prevTotal, nextTotal);
    if (change >= 25) return "t2";
    if (change >= 10) return "t1";
    return "t0";
  }

  if (widget.type === "donut") {
    const prev = parsePresetData("donut", prevData);
    const patch = nextData as { segments?: typeof prev.segments };
    const nextSegments = patch.segments ?? prev.segments;
    const prevTotal = prev.segments.reduce((a, s) => a + s.value, 0);
    const nextTotal = nextSegments.reduce((a, s) => a + s.value, 0);
    const change = pctDelta(prevTotal, nextTotal);
    if (change >= 25) return "t2";
    if (change >= 10) return "t1";
    return "t0";
  }

  if (widget.type === "table") {
    const prev = parsePresetData("table", prevData);
    const patch = nextData as { rows?: typeof prev.rows };
    const nextRows = patch.rows ?? prev.rows;
    const statusKeys = prev.columns.filter((c) => c.type === "status").map((c) => c.key);
    const isDown = (v: unknown) =>
      typeof v === "string" && ["down", "critical", "error", "offline"].includes(v.toLowerCase());
    const hadDown = prev.rows.some((r) => statusKeys.some((k) => isDown(r[k])));
    const hasDown = nextRows.some((r) => statusKeys.some((k) => isDown(r[k])));
    if (!hadDown && hasDown) return "t3";
    if (hadDown && !hasDown) return "t2";
    return "t0";
  }

  if (widget.type === "ticker") {
    const prev = parsePresetData("ticker", prevData);
    const patch = nextData as { lines?: typeof prev.lines };
    const nextLines = patch.lines ?? prev.lines;
    const newest = nextLines[0];
    const prevNewest = prev.lines[0];
    const isNew = newest && (newest.t !== prevNewest?.t || newest.text !== prevNewest?.text);
    if (isNew && newest.level === "error") return "t2";
    if (isNew && newest.level === "warn") return "t1";
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
  if (widget.type === "table") {
    const d = parsePresetData("table", data);
    const statusKeys = d.columns.filter((c) => c.type === "status").map((c) => c.key);
    return d.rows.some((r) =>
      statusKeys.some(
        (k) => typeof r[k] === "string" && ["down", "critical", "error", "offline"].includes(r[k].toLowerCase())
      )
    );
  }
  return false;
}
