import { HeroValue } from "@/lib/archetypes/heroValue";
import type { WidgetSlot } from "@/lib/layout/types";

export function Stat({
  slot = "supporting",
  label,
  value,
  unit,
  delta,
  spark,
}: {
  slot?: WidgetSlot;
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  spark?: number[];
}) {
  return <HeroValue slot={slot} label={label} value={value} unit={unit} delta={delta} spark={spark} />;
}
