import { BarChartCard } from "@/lib/archetypes/barChartCard";
import type { WidgetSlot } from "@/lib/layout/types";

export function BarChart({
  slot = "supporting",
  label,
  categories,
}: {
  slot?: WidgetSlot;
  label: string;
  categories: { label: string; value: number }[];
}) {
  return <BarChartCard slot={slot} label={label} categories={categories} />;
}
