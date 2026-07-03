import type { ThemeTokens } from "@/lib/schema";

function parseHex(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linear token interpolation for theme morph (§6.5). Colors lerp in RGB; OKLCH is Phase B polish. */
export function interpolateTheme(from: ThemeTokens, to: ThemeTokens, t: number): ThemeTokens {
  const p = from.palette;
  const q = to.palette;

  return {
    ...to,
    palette: {
      bg0: lerpHex(p.bg0, q.bg0, t),
      bg1: lerpHex(p.bg1, q.bg1, t),
      surfaceTint: lerpHex(p.surfaceTint, q.surfaceTint, t),
      text1: lerpHex(p.text1, q.text1, t),
      text2: lerpHex(p.text2, q.text2, t),
      accent1: lerpHex(p.accent1, q.accent1, t),
      accent2: lerpHex(p.accent2, q.accent2, t),
      positive: lerpHex(p.positive, q.positive, t),
      negative: lerpHex(p.negative, q.negative, t),
    },
    type: {
      ...to.type,
      scaleRatio: lerp(from.type.scaleRatio, to.type.scaleRatio, t),
    },
    shape: {
      ...to.shape,
      radius: lerp(from.shape.radius, to.shape.radius, t),
    },
    motion: {
      ...to.motion,
      speed: lerp(from.motion.speed, to.motion.speed, t),
    },
    background: t < 0.5 ? from.background : to.background,
  };
}

export const THEME_MORPH_MS = 1600;

/** Scene morph easing (§4.2): exit 500 → background 400 → enter 700 */
export function themeMorphEase(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
