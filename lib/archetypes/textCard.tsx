import { Label } from "@/components/primitives/Label";
import { Text } from "@/components/primitives/Text";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

const headlineSizeForSlot: Record<ArchetypeSlot, string> = {
  hero: "var(--n-headline-size)",
  supporting: "calc(var(--n-headline-size) * 0.72)",
  ambient: "calc(var(--n-headline-size) * 0.45)",
};

const toneColor = {
  neutral: "var(--n-text1)",
  positive: "var(--n-positive)",
  negative: "var(--n-negative)",
} as const;

/** textCard archetype (§7.2): kicker + display text, sized by narrative slot. */
export function TextCard({
  slot,
  text,
  kicker,
  tone = "neutral",
}: {
  slot: ArchetypeSlot;
  text: string;
  kicker?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const pad = surfacePadForSlot[slot];

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        {kicker && <Label className="shrink-0">{kicker}</Label>}
        <Text
          text={text}
          maxLines={1}
          className="min-w-0 font-medium"
          style={{ fontSize: headlineSizeForSlot.ambient, color: toneColor[tone] }}
        />
      </div>
    );
  }

  return (
    <div
      className={`n-surface flex h-full w-full flex-col justify-center gap-3 ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}
    >
      {kicker && <Label>{kicker}</Label>}
      <Text
        text={text}
        maxLines={slot === "hero" ? 2 : 2}
        className="font-medium"
        style={{
          fontSize: headlineSizeForSlot[slot],
          fontWeight: 500,
          color: toneColor[tone],
        }}
      />
    </div>
  );
}
