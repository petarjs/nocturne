import { MediaCard } from "@/lib/archetypes/mediaCard";
import type { WidgetSlot } from "@/lib/layout/types";

export function ImageWidget({
  slot = "supporting",
  label,
  src,
  alt,
  fit,
  kenBurns = false,
}: {
  slot?: WidgetSlot;
  label?: string;
  src: string;
  alt?: string;
  fit: "cover" | "contain";
  kenBurns?: boolean;
}) {
  return (
    <MediaCard
      slot={slot}
      label={label}
      source={{ kind: "image", src, alt: alt ?? label ?? "Dashboard image", fit, kenBurns }}
    />
  );
}
