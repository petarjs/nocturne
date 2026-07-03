import type { ThemeTokens } from "@/lib/schema";
import { observatory } from "./observatory";
import { kanso } from "./kanso";
import { noir } from "./noir";

export { observatory, kanso, noir };

export const themePresets: Record<string, ThemeTokens> = {
  observatory,
  kanso,
  noir,
};

export function resolveTheme(theme: ThemeTokens | { preset: string }): ThemeTokens {
  if ("palette" in theme) return theme;
  const preset = themePresets[theme.preset];
  if (!preset) throw new Error(`Unknown theme preset: ${theme.preset}`);
  return preset;
}
