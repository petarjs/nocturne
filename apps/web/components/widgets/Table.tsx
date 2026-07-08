import { TableCard } from "@/lib/archetypes/tableCard";
import type { WidgetSlot } from "@/lib/layout/types";

type Column = { key: string; label: string; type: "text" | "num" | "delta" | "status" };

export function Table({
  slot = "supporting",
  label,
  columns,
  rows,
}: {
  slot?: WidgetSlot;
  label?: string;
  columns: Column[];
  rows: Record<string, string | number>[];
}) {
  return <TableCard slot={slot} label={label} columns={columns} rows={rows} />;
}
