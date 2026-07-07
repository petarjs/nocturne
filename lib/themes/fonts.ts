/** Maps human-readable family names in theme tokens → next/font CSS variables (§3.2). */
export const fontFamilyVars: Record<string, string> = {
  Sora: "var(--font-sora)",
  "Spline Sans Mono": "var(--font-spline-mono)",
  "Chakra Petch": "var(--font-chakra-petch)",
  "IBM Plex Mono": "var(--font-ibm-plex-mono)",
  "Shippori Mincho": "var(--font-shippori-mincho)",
  "M PLUS 1 Code": "var(--font-mplus1-code)",
  "Space Grotesk": "var(--font-space-grotesk)",
  "Geist Mono": "var(--font-geist-mono)",
};

export function resolveFontVar(familyName: string): string {
  return fontFamilyVars[familyName] ?? fontFamilyVars.Sora;
}
