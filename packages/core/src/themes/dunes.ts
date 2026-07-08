import type { ThemeTokens } from "../schema";

/** Pastel Dunes — rolling velvet dunes at permanent golden hour, sun-lit
 * cumulus drifting over a periwinkle-to-peach sky (§5 `dunes` engine).
 * Signature: the clouds — lit like a Ghibli matte painting, always moving;
 * their shadows cross the sand below. */
export const dunes: ThemeTokens = {
  id: "dunes",
  palette: {
    bg0: "#262A4F",
    bg1: "#343A66",
    surfaceTint: "#ABA8DC",
    text1: "#FBF5EC",
    text2: "#B6B4D6",
    accent1: "#F5A9BC",
    accent2: "#93A7E8",
    positive: "#8FD9AF",
    negative: "#F2818C",
  },
  type: {
    display: "Space Grotesk",
    data: "Geist Mono",
    scaleRatio: 1.45,
  },
  shape: {
    radius: 18,
    border: "hairline",
    blur: true,
  },
  motion: {
    dialect: "calm",
    speed: 1,
  },
  background: {
    engine: "dunes",
    params: { wind: 1, cloudCover: 0.5, sunX: 0.3, glint: 1 },
  },
  density: "normal",
};
