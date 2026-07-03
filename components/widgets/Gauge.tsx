import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Arc } from "@/components/primitives/Arc";

// The `gauge` preset (§7.3): label + arc sweep with warn/crit zones.
export function Gauge({
  label,
  value,
  min,
  max,
  warn,
  crit,
  unit = "%",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  warn?: number;
  crit?: number;
  unit?: string;
}) {
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

  return (
    <div className="n-surface flex h-full w-full flex-col gap-2 p-6">
      <Label>{label}</Label>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
        <div className="relative flex items-center justify-center">
          <Arc fraction={fraction} size={88} strokeWidth={5} color={arcColor} zones={zones} />
          <div className="absolute flex items-baseline gap-1">
            <Value value={value} decimals={0} size="value-m" />
            <Unit>{unit}</Unit>
          </div>
        </div>
      </div>
    </div>
  );
}
