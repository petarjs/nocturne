import { Matrix } from "@/lib/archetypes/matrix";
import type { WidgetSlot } from "@/lib/layout/types";

type StatusItem = {
  id: string;
  label: string;
  state: "up" | "down" | "degraded";
  latency?: number;
};

export function StatusGrid({
  label,
  items,
  slot = "supporting",
  critical = false,
}: {
  label?: string;
  items: StatusItem[];
  slot?: WidgetSlot;
  critical?: boolean;
}) {
  return <Matrix slot={slot} label={label} items={items} critical={critical} />;
}
