import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Chart } from "@/components/primitives/Chart";
import { EmptyState } from "@/components/primitives/EmptyState";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type SeriesPoint = { t: number; v: number };

const chartValueSizeForSlot = {
  hero: "value-l",
  supporting: "value-m",
  ambient: "value-s",
} as const;

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
  const hasTrend = series.length > 1;
  const valueSize = chartValueSizeForSlot[slot];
  const decimals = current % 1 !== 0 ? 1 : 0;

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="w-16 shrink-0 leading-tight">{label}</Label>
        <div className="flex min-w-0 flex-1 items-baseline gap-1">
          {series.length > 0 ? (
            <>
              <Value value={current} decimals={decimals} size="value-s" />
              {unit && <Unit className="!text-[calc(var(--n-meta-size)*0.85)]">{unit}</Unit>}
            </>
          ) : (
            <EmptyState compact />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad}`}>
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-baseline gap-1.5">
          {series.length > 0 && <Value value={current} decimals={decimals} size={valueSize} />}
          {series.length > 0 && unit && <Unit>{unit}</Unit>}
          {windowLabel && (
            <span className="n-data ml-1" style={{ color: "var(--n-text2)", fontSize: "calc(var(--n-meta-size) * 0.85)" }}>
              {windowLabel}
            </span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {hasTrend ? (
          <Chart series={series} variant="area" id={`chart-${label}`} label={`${label} trend`} />
        ) : (
          <EmptyState message={series.length === 1 ? "Building trend" : "Awaiting trend"} />
        )}
      </div>
    </div>
  );
}
