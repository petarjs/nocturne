import { TextCard } from "@/lib/archetypes/textCard";
import type { WidgetSlot } from "@/lib/layout/types";

/** The `headline` preset (§7.3): narrator captions — agents write the story. */
export function Headline({
  slot = "supporting",
  text,
  kicker,
  tone = "neutral",
}: {
  slot?: WidgetSlot;
  text: string;
  kicker?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return <TextCard slot={slot} text={text} kicker={kicker} tone={tone} />;
}
