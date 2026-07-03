import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Chart } from "@/components/primitives/Chart";

type SeriesPoint = { t: number; v: number };

// The `timeseries` preset (§7.3): chartCard archetype — label + area chart +
// current value.
export function Timeseries({
  label,
  series,
  window: windowLabel,
  unit = "Mbps",
}: {
  label: string;
  series: SeriesPoint[];
  window?: string;
  unit?: string;
}) {
  const current = series.length > 0 ? series[series.length - 1].v : 0;

  return (
    <div className="n-surface flex h-full w-full flex-col gap-2 p-6">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {windowLabel && (
          <span className="n-data text-[12px]" style={{ color: "var(--n-text2)" }}>
            {windowLabel}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <Value value={current} decimals={1} size="value-s" />
        <Unit>{unit}</Unit>
      </div>
      <div className="min-h-0 flex-1">
        <Chart series={series} variant="area" />
      </div>
    </div>
  );
}
