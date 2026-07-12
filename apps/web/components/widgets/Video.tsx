import { MediaCard } from "@/lib/archetypes/mediaCard";
import type { WidgetSlot } from "@/lib/layout/types";

export function VideoWidget({
  slot = "supporting",
  label,
  src,
  poster,
  loop,
}: {
  slot?: WidgetSlot;
  label?: string;
  src: string;
  poster: string;
  loop: boolean;
}) {
  return (
    <MediaCard
      slot={slot}
      label={label}
      source={{ kind: "video", src, poster, loop, alt: label ?? "Dashboard video" }}
    />
  );
}
