import { ImageMedia, VideoMedia } from "@/components/primitives/Media";
import { Label } from "@/components/primitives/Label";
import type { ArchetypeSlot } from "./types";

type ImageSource = {
  kind: "image";
  src: string;
  alt: string;
  fit: "cover" | "contain";
  kenBurns: boolean;
};

type VideoSource = {
  kind: "video";
  src: string;
  poster: string;
  loop: boolean;
  alt: string;
};

/** Full-bleed media with a restrained readability veil and optional label. */
export function MediaCard({
  slot,
  label,
  source,
}: {
  slot: ArchetypeSlot;
  label?: string;
  source: ImageSource | VideoSource;
}) {
  return (
    <div
      className={`n-surface relative h-full w-full overflow-hidden ${slot === "hero" ? "n-surface--hero" : ""}`}
    >
      <div className="absolute inset-0">
        {source.kind === "image" ? (
          <ImageMedia {...source} />
        ) : (
          <VideoMedia {...source} fit="cover" />
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,16,0.08),rgba(5,8,16,0.58))]" />
      {label && (
        <Label className="absolute bottom-[calc(var(--n-density-pad)*0.7)] left-[calc(var(--n-density-pad)*0.85)] text-[var(--n-text1)] opacity-90">
          {label}
        </Label>
      )}
    </div>
  );
}
