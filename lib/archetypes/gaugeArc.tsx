"use client";

import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Arc } from "@/components/primitives/Arc";
import { useContainerSize } from "@/components/hooks/useContainerSize";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

/** Stroke scales with arc diameter — fixed px looked too thin on hero slots. */
function gaugeStrokeWidth(arcSize: number, slot: ArchetypeSlot): number {
  const ratio = slot === "hero" ? 0.048 : slot === "supporting" ? 0.044 : 0.052;
  const max = slot === "hero" ? 12 : slot === "supporting" ? 8 : 5;
  return Math.max(2, Math.min(max, Math.round(arcSize * ratio)));
}

/** Interior value scales with arc diameter — digit count tightens the ratio. */
function gaugeInteriorFontSize(arcSize: number, value: number, slot: ArchetypeSlot): number {
  const digits = String(Math.round(value)).length;
  const ratio = slot === "hero" ? 0.36 : slot === "supporting" ? 0.34 : 0.4;
  const digitScale = digits >= 3 ? 0.72 : digits >= 2 ? 1 : 1.08;
  return Math.max(14, Math.round(arcSize * ratio * digitScale));
}

/** Gauge preset: label + arc sweep with warn/crit zones, sized by narrative slot. */
export function GaugeArc({
  slot,
  label,
  value,
  min,
  max,
  warn,
  crit,
  unit = "%",
}: {
  slot: ArchetypeSlot;
  label: string;
  value: number;
  min: number;
  max: number;
  warn?: number;
  crit?: number;
  unit?: string;
}) {
  const pad = surfacePadForSlot[slot];
  const span = max - min || 1;
  const fraction = (value - min) / span;
  const toFrac = (v: number) => (v - min) / span;

  const zones = [
    warn !== undefined ? { at: toFrac(warn), color: "var(--n-accent1)" } : null,
    crit !== undefined ? { at: toFrac(crit), color: "var(--n-negative)" } : null,
  ].filter((z): z is { at: number; color: string } => z !== null);

  const arcColor =
    crit !== undefined && value >= crit
      ? "var(--n-negative)"
      : warn !== undefined && value >= warn
        ? "var(--n-accent1)"
        : "var(--n-accent1)";

  const { ref: arcContainerRef, width, height } = useContainerSize<HTMLDivElement>();
  const arcSize = Math.max(48, Math.floor(Math.min(width, height) * 0.92));
  const valueFontSize = gaugeInteriorFontSize(arcSize, value, slot);
  const unitFontSize = Math.round(valueFontSize * 0.38);
  const strokeWidth = gaugeStrokeWidth(arcSize, slot);

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="w-16 shrink-0 leading-tight">{label}</Label>
        <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
          <div ref={arcContainerRef} className="relative flex h-full max-h-full w-full max-w-[72px] items-center justify-center">
            {arcSize > 0 && (
              <>
                <Arc fraction={fraction} size={arcSize} strokeWidth={strokeWidth} color={arcColor} zones={zones} />
                <div className="absolute flex items-baseline">
                  <Value value={value} decimals={0} fontSize={valueFontSize} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      <Label className="shrink-0">{label}</Label>
      <div ref={arcContainerRef} className="flex min-h-0 flex-1 items-center justify-center">
        {arcSize > 0 && (
          <div className="relative flex items-center justify-center">
            <Arc
              fraction={fraction}
              size={arcSize}
              strokeWidth={strokeWidth}
              color={arcColor}
              zones={zones}
            />
            <div className="absolute flex items-baseline gap-1">
              <Value value={value} decimals={0} fontSize={valueFontSize} />
              <Unit style={{ fontSize: unitFontSize }}>{unit}</Unit>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
