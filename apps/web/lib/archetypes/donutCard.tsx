import { Label } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { DonutRing } from "@/components/primitives/DonutRing";
import { useContainerSize } from "@/components/hooks/useContainerSize";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type Segment = { label: string; value: number };

const RAMP_OPACITY = [1, 0.7, 0.5, 0.35, 0.25];

/** chartCard archetype (§7.2), donut variant: ring + center total + legend. */
export function DonutCard({
  slot,
  label,
  segments,
}: {
  slot: ArchetypeSlot;
  label: string;
  segments: Segment[];
}) {
  const pad = surfacePadForSlot[slot];
  const total = segments.reduce((a, s) => a + s.value, 0);
  const { ref, width, height } = useContainerSize<HTMLDivElement>();
  const size = Math.max(48, Math.floor(Math.min(width, height) * 0.9));

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="w-16 shrink-0 leading-tight">{label}</Label>
        <div ref={ref} className="relative flex h-full max-w-[56px] flex-1 items-center justify-center">
          {size > 0 && (
            <>
              <DonutRing segments={segments} size={size} id={`donut-${label}`} />
              <div className="absolute z-10 flex items-baseline">
                <Value value={total} decimals={0} fontSize={Math.round(size * 0.28)} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      <Label className="shrink-0">{label}</Label>
      <div className="flex min-h-0 flex-1 items-center gap-4">
        <div ref={ref} className="relative flex h-full flex-1 items-center justify-center">
          {size > 0 && (
            <>
              <DonutRing segments={segments} size={size} id={`donut-${label}`} />
              <div className="absolute z-10 flex items-baseline [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">
                <Value value={total} decimals={0} fontSize={Math.round(size * 0.22)} />
              </div>
            </>
          )}
        </div>
        <div className="flex min-w-0 shrink-0 flex-col gap-1.5">
          {segments.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: `color-mix(in srgb, var(--n-accent1) ${Math.round(RAMP_OPACITY[i % RAMP_OPACITY.length] * 100)}%, transparent)`,
                }}
              />
              <span
                className="n-data min-w-0 truncate text-[length:calc(var(--n-meta-size)*0.9)]"
                style={{ color: "var(--n-text2)" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
