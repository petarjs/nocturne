import { ChartCard } from "@/lib/archetypes/chartCard";
import type { WidgetSlot } from "@/lib/layout/types";

type SeriesPoint = { t: number; v: number };

export function Timeseries({
  slot = "supporting",
  label,
  series,
  window: windowLabel,
  unit = "Mbps",
}: {
  slot?: WidgetSlot;
  label: string;
  series: SeriesPoint[];
  window?: string;
  unit?: string;
}) {
  return <ChartCard slot={slot} label={label} series={series} window={windowLabel} unit={unit} />;
}
