import type { WidgetSlot } from "@/lib/layout/types";

/** Archetype slot geometry is driven by narrative role, never per-widget CSS (§7.2). */
export type ArchetypeSlot = WidgetSlot;

export const valueSizeForSlot = {
  hero: "value-hero",
  supporting: "value-m",
  ambient: "value-s",
} as const;

export const surfacePadForSlot = {
  hero: "p-6",
  supporting: "p-5",
  ambient: "px-4 py-2",
} as const;
