import type { ThemeTokens } from "@/lib/schema";

/** Twilight valley — lavender dusk sky, layered mountains, wind-swayed
 * flowering bushes and grass in the foreground (§5 `meadow` engine). */
export const meadow: ThemeTokens = {
  id: "meadow",
  palette: {
    bg0: "#1B1F3A",
    bg1: "#262C52",
    surfaceTint: "#9AA0C9",
    text1: "#F5EEF7",
    text2: "#A6A8C9",
    accent1: "#E8A9D0",
    accent2: "#8FB0D9",
    positive: "#4ADE80",
    negative: "#F87171",
  },
  type: {
    display: "Sora",
    data: "Spline Sans Mono",
    scaleRatio: 1.45,
  },
  shape: {
    radius: 16,
    border: "hairline",
    blur: true,
  },
  motion: {
    dialect: "calm",
    speed: 1,
  },
  background: {
    engine: "meadow",
  },
  density: "normal",
};
