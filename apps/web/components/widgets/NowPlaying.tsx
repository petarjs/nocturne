import { NowPlayingCard } from "@/lib/archetypes/nowPlayingCard";
import type { WidgetSlot } from "@/lib/layout/types";

export function NowPlaying({ slot = "supporting", ...props }: {
  slot?: WidgetSlot;
  label?: string;
  title: string;
  artist: string;
  artUrl?: string;
  progress: number;
  state: "playing" | "paused";
}) {
  return <NowPlayingCard slot={slot} {...props} />;
}
