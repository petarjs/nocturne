import { GaugeArc } from "@/lib/archetypes/gaugeArc";
import type { WidgetSlot } from "@/lib/layout/types";

export function Gauge({
  slot = "supporting",
  label,
  value,
  min,
  max,
  warn,
  crit,
  unit = "%",
}: {
  slot?: WidgetSlot;
  label: string;
  value: number;
  min: number;
  max: number;
  warn?: number;
  crit?: number;
  unit?: string;
}) {
  return (
    <GaugeArc slot={slot} label={label} value={value} min={min} max={max} warn={warn} crit={crit} unit={unit} />
  );
}
