// Custom-theme safety: the design system requires text1 to clear WCAG AA (4.5:1)
// against bg0 (§3.1 "auto-clamped"). When the agent composes a custom ThemeTokens
// for a free-text vibe, we nudge the text lightness until it clears before applying.

import { wcagContrast, oklch, formatHex } from "culori";
import type { ThemeTokens } from "@nocturne/core";
import { themePresets } from "@nocturne/core/themes";

const MIN_CONTRAST = 4.5;

export const PRESET_IDS = Object.keys(themePresets);

/** Return a theme whose text1 clears 4.5:1 on bg0, adjusting text lightness if needed. */
export function clampThemeContrast(theme: ThemeTokens): ThemeTokens {
  const bg = theme.palette.bg0;
  const text = theme.palette.text1;
  if (contrast(text, bg) >= MIN_CONTRAST) return theme;

  const to = oklch(text);
  const bo = oklch(bg);
  if (!to || !bo) return theme;

  const goLighter = (bo.l ?? 0) < 0.5;
  let l = to.l ?? (goLighter ? 0.9 : 0.1);
  let result = text;
  for (let i = 0; i < 30; i++) {
    l = goLighter ? Math.min(1, l + 0.03) : Math.max(0, l - 0.03);
    const candidate = formatHex({ ...to, l }) ?? text;
    result = candidate;
    if (contrast(candidate, bg) >= MIN_CONTRAST) break;
  }
  return { ...theme, palette: { ...theme.palette, text1: result } };
}

function contrast(a: string, b: string): number {
  try {
    return wcagContrast(a, b);
  } catch {
    return 0;
  }
}
