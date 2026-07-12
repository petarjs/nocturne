import { Arc } from "@/components/primitives/Arc";
import { ImageMedia } from "@/components/primitives/Media";
import { Label } from "@/components/primitives/Label";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

export function NowPlayingCard({
  slot,
  label,
  title,
  artist,
  artUrl,
  progress,
  state,
}: {
  slot: ArchetypeSlot;
  label?: string;
  title: string;
  artist: string;
  artUrl?: string;
  progress: number;
  state: "playing" | "paused";
}) {
  const pad = surfacePadForSlot[slot];
  const status = state === "playing" ? "Playing" : "Paused";

  if (slot === "ambient") {
    return (
      <div className={`n-surface relative flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        {artUrl && (
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[calc(var(--n-radius)*0.45)] opacity-90">
            <ImageMedia src={artUrl} alt="" fit="cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="n-data truncate text-[length:var(--n-meta-size)]">{title}</div>
          <Label className="truncate normal-case tracking-[0.04em]">{artist}</Label>
        </div>
        <Label className="shrink-0">{status}</Label>
      </div>
    );
  }

  const ringSize = slot === "hero" ? 112 : 76;
  return (
    <div className={`n-surface relative flex h-full w-full items-center gap-6 overflow-hidden ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      {artUrl && (
        <div className="pointer-events-none absolute inset-0 scale-110 opacity-[0.12] blur-2xl">
          <ImageMedia src={artUrl} alt="" fit="cover" />
        </div>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <Label>{label ?? status}</Label>
        <div
          className="truncate font-medium leading-tight"
          style={{ fontFamily: "var(--n-font-display)", fontSize: slot === "hero" ? "var(--n-headline-size)" : "calc(var(--n-headline-size)*0.62)" }}
        >
          {title}
        </div>
        <div className="n-data truncate text-[length:var(--n-meta-size)]" style={{ color: "var(--n-text2)" }}>
          {artist}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center justify-center">
        <Arc fraction={progress} size={ringSize} strokeWidth={slot === "hero" ? 4 : 3} id={`playing-${title}`} />
        <span className="n-label absolute">{state === "playing" ? "▶" : "Ⅱ"}</span>
      </div>
    </div>
  );
}
