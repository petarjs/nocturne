import { interpolate, formatHex } from "culori";
import type { ThemeTokens } from "@/lib/schema";

function lerpOklchHex(a: string, b: string, t: number): string {
  const result = interpolate([a, b], "oklch")(t);
  const hex = formatHex(result);
  return hex ?? a;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** OKLCH token interpolation for theme morph (§6.5) — no muddy RGB mid-morph. */
export function interpolateTheme(from: ThemeTokens, to: ThemeTokens, t: number): ThemeTokens {
  const p = from.palette;
  const q = to.palette;

  return {
    ...to,
    palette: {
      bg0: lerpOklchHex(p.bg0, q.bg0, t),
      bg1: lerpOklchHex(p.bg1, q.bg1, t),
      surfaceTint: lerpOklchHex(p.surfaceTint, q.surfaceTint, t),
      text1: lerpOklchHex(p.text1, q.text1, t),
      text2: lerpOklchHex(p.text2, q.text2, t),
      accent1: lerpOklchHex(p.accent1, q.accent1, t),
      accent2: lerpOklchHex(p.accent2, q.accent2, t),
      positive: lerpOklchHex(p.positive, q.positive, t),
      negative: lerpOklchHex(p.negative, q.negative, t),
    },
    type: {
      ...to.type,
      scaleRatio: lerp(from.type.scaleRatio, to.type.scaleRatio, t),
    },
    shape: {
      border: t < 0.5 ? from.shape.border : to.shape.border,
      blur: t < 0.5 ? from.shape.blur : to.shape.blur,
      radius: lerp(from.shape.radius, to.shape.radius, t),
    },
    motion: {
      ...to.motion,
      speed: lerp(from.motion.speed, to.motion.speed, t),
    },
    background: t < 0.5625 ? from.background : to.background, // handoff at 900ms / 1600ms
  };
}

export const THEME_MORPH_MS = 1600;

/** Scene morph act boundaries (§4.2): exit 500 → background 400 → enter 700 */
export const MORPH_EXIT_MS = 500;
export const MORPH_BG_MS = 400;
export const MORPH_ENTER_MS = 700;

export function morphActs(elapsedMs: number) {
  const exitT = Math.min(1, elapsedMs / MORPH_EXIT_MS);
  const bgT = elapsedMs < MORPH_EXIT_MS ? 0 : Math.min(1, (elapsedMs - MORPH_EXIT_MS) / MORPH_BG_MS);
  const enterT =
    elapsedMs < MORPH_EXIT_MS + MORPH_BG_MS
      ? 0
      : Math.min(1, (elapsedMs - MORPH_EXIT_MS - MORPH_BG_MS) / MORPH_ENTER_MS);
  const tokenT = Math.min(1, elapsedMs / THEME_MORPH_MS);
  return { exitT, bgT, enterT, tokenT };
}
