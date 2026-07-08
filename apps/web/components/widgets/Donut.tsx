import { DonutCard } from "@/lib/archetypes/donutCard";
import type { WidgetSlot } from "@/lib/layout/types";

export function Donut({
  slot = "supporting",
  label,
  segments,
}: {
  slot?: WidgetSlot;
  label: string;
  segments: { label: string; value: number }[];
}) {
  return <DonutCard slot={slot} label={label} segments={segments} />;
}
