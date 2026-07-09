import type { ThemeTokens } from "../schema";

/** Verdant Field — abstract organic grass in soft motion-blur sway, backlit
 * by a cream sky that follows the wall clock (§5 `grass` engine). Signature:
 * the long-exposure blade streaks; the wind is the nervous system. */
export const grass: ThemeTokens = {
  id: "grass",
  palette: {
    bg0: "#070E09",
    bg1: "#101810",
    surfaceTint: "#8FA88F",
    text1: "#F4EFE4",
    text2: "#9AAB9A",
    accent1: "#C8B86A",
    accent2: "#3D5A38",
    positive: "#7FD8A4",
    negative: "#E07060",
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
    engine: "grass",
    params: { wind: 1, sunX: 0.78, sunY: 0.72 },
  },
  density: "airy",
};
