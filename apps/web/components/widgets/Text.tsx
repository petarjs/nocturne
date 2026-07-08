import { TextCard } from "@/lib/archetypes/textCard";
import type { WidgetSlot } from "@/lib/layout/types";

/** The `text` preset (§7.3): md-lite free text, no narrator kicker/tone. */
export function Text({
  slot = "supporting",
  md,
}: {
  slot?: WidgetSlot;
  md: string;
}) {
  return <TextCard slot={slot} text={md} markdown />;
}
