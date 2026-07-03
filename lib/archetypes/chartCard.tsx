import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Chart } from "@/components/primitives/Chart";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot, valueSizeForSlot } from "./types";

type SeriesPoint = { t: number; v: number };

/** chartCard archetype (§7.2): label + chart + current value. */
export function ChartCard({
  slot,
  label,
  series,
  window: windowLabel,
  unit = "Mbps",
}: {
  slot: ArchetypeSlot;
  label: string;
  series: SeriesPoint[];
  window?: string;
  unit?: string;
}) {
  const pad = surfacePadForSlot[slot];
  const current = series.length > 0 ? series[series.length - 1].v : 0;
  const valueSize = valueSizeForSlot[slot];

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Label>{label}</Label>
        {windowLabel && (
          <span className="n-data text-[12px]" style={{ color: "var(--n-text2)" }}>
            {windowLabel}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        <Value value={current} decimals={1} size={valueSize} />
        <Unit>{unit}</Unit>
      </div>
      <div className="min-h-0 flex-1">
        <Chart series={series} variant="area" />
      </div>
    </div>
  );
}
