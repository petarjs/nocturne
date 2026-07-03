import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Arc } from "@/components/primitives/Arc";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot, valueSizeForSlot } from "./types";

const arcSizeForSlot = { hero: 148, supporting: 112, ambient: 64 } as const;

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

  const arcSize = arcSizeForSlot[slot];
  const valueSize = valueSizeForSlot[slot];

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="w-16 shrink-0 leading-tight">{label}</Label>
        <div className="relative flex shrink-0 items-center justify-center">
          <Arc fraction={fraction} size={arcSize} strokeWidth={4} color={arcColor} zones={zones} />
          <div className="absolute flex items-baseline gap-0.5">
            <Value value={value} decimals={0} size="value-s" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad}`}>
      <Label className="shrink-0">{label}</Label>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <Arc fraction={fraction} size={arcSize} strokeWidth={slot === "hero" ? 6 : 5} color={arcColor} zones={zones} />
          <div className="absolute flex items-baseline gap-1">
            <Value value={value} decimals={0} size={valueSize} />
            <Unit>{unit}</Unit>
          </div>
        </div>
      </div>
    </div>
  );
}
