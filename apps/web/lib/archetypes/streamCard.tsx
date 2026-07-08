import { Label } from "@/components/primitives/Label";
import { Stream } from "@/components/primitives/Stream";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type Line = { t: string; text: string; level?: "info" | "warn" | "error" };

/** streamCard archetype (§7.2): label + ticker line engine. */
export function StreamCard({
  slot,
  label,
  lines,
}: {
  slot: ArchetypeSlot;
  label?: string;
  lines: Line[];
}) {
  const pad = surfacePadForSlot[slot];

  if (slot === "ambient") {
    const latest = lines[0];
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        {label && <Label className="w-16 shrink-0 leading-tight">{label}</Label>}
        {latest && (
          <span
            className="n-data min-w-0 flex-1 truncate text-[length:var(--n-meta-size)]"
            style={{ color: "var(--n-text2)" }}
          >
            {latest.text}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-3 overflow-hidden ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      {label && <Label>{label}</Label>}
      <Stream lines={lines} maxVisible={slot === "hero" ? 10 : 6} />
    </div>
  );
}
