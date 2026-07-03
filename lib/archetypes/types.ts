import type { WidgetSlot } from "@/lib/layout/types";

/** Archetype slot geometry is driven by narrative role, never per-widget CSS (§7.2). */
export type ArchetypeSlot = WidgetSlot;

export const valueSizeForSlot = {
  hero: "value-hero",
  supporting: "value-m",
  ambient: "value-s",
} as const;

/** Padding scales with --n-density-pad from ThemeScope (§3.3). */
export const surfacePadForSlot = {
  hero: "p-[var(--n-density-pad)]",
  supporting: "p-[calc(var(--n-density-pad)*0.85)]",
  ambient: "px-[calc(var(--n-density-pad)*0.85)] py-2",
} as const;
