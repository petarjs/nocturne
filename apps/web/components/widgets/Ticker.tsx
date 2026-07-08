import { StreamCard } from "@/lib/archetypes/streamCard";
import type { WidgetSlot } from "@/lib/layout/types";

type Line = { t: string; text: string; level?: "info" | "warn" | "error" };

export function Ticker({
  slot = "supporting",
  label,
  lines,
}: {
  slot?: WidgetSlot;
  label?: string;
  lines: Line[];
}) {
  return <StreamCard slot={slot} label={label} lines={lines} />;
}
