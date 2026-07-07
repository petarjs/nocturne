import type { ThemeTokens } from "@/lib/schema";
import { observatory } from "./observatory";
import { kanso } from "./kanso";
import { noir } from "./noir";
import { meadow } from "./meadow";
import { borealis } from "./borealis";

export { observatory, kanso, noir, meadow, borealis };
export { fontFamilyVars, resolveFontVar } from "./fonts";

export const themePresets: Record<string, ThemeTokens> = {
  observatory,
  kanso,
  noir,
  meadow,
  borealis,
};

export function resolveTheme(theme: ThemeTokens | { preset: string }): ThemeTokens {
  if ("palette" in theme) return theme;
  const preset = themePresets[theme.preset];
  if (!preset) throw new Error(`Unknown theme preset: ${theme.preset}`);
  return preset;
}
