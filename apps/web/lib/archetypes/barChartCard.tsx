import { Label } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Bars } from "@/components/primitives/Bars";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type Category = { label: string; value: number };

/** chartCard archetype (§7.2), categorical variant: label + bars + total. */
export function BarChartCard({
  slot,
  label,
  categories,
}: {
  slot: ArchetypeSlot;
  label: string;
  categories: Category[];
}) {
  const pad = surfacePadForSlot[slot];
  const total = categories.reduce((a, c) => a + c.value, 0);

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="w-16 shrink-0 leading-tight">{label}</Label>
        <div className="h-full min-h-0 min-w-0 flex-1 py-1">
          <Bars categories={categories} id={`bars-${label}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <Value value={total} decimals={0} size={slot === "hero" ? "value-m" : "value-s"} />
      </div>
      <div className="min-h-0 flex-1 pt-1">
        <Bars categories={categories} showValues={slot === "hero"} id={`bars-${label}`} />
      </div>
    </div>
  );
}
