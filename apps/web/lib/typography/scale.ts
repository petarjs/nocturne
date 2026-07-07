/** Design resolution and viewport scale (§3.3). */
export const DESIGN_HEIGHT = 1080;

export function viewportScale(height: number): number {
  return Math.min(2, Math.max(0.6, height / DESIGN_HEIGHT));
}

export const TYPE_SCALE = {
  label: 13,
  meta: 14,
  body: 16,
  headline: 56,
  "value-s": 28,
  "value-m": 44,
  "value-l": 76,
  "value-hero": 132,
} as const;

export type ValueSize = keyof Pick<typeof TYPE_SCALE, "value-s" | "value-m" | "value-l" | "value-hero">;

export function scaledSize(role: ValueSize, scale: number): number {
  return Math.round(TYPE_SCALE[role] * scale);
}
