import type { ThemeTokens } from "../schema";

/** Twilight valley — lavender dusk sky, layered mountains, wind-swayed
 * flowering bushes and grass in the foreground (§5 `meadow` engine). */
export const meadow: ThemeTokens = {
  id: "meadow",
  palette: {
    bg0: "#20244A",
    bg1: "#2E3263",
    surfaceTint: "#A5A2D6",
    text1: "#F6EFE2",
    text2: "#A9A8C8",
    accent1: "#F2A6C0",
    accent2: "#8E8BC9",
    positive: "#7FD8A4",
    negative: "#F17E88",
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
