import type { ThemeTokens } from "../schema";

/** Green neon wave curtains over an emerald void — vertical-striated light
 * flowing slowly leftward, glow breathing wider and tighter (§5 `borealis`
 * engine). Signature: the breathing glow; the waves are the nervous system. */
export const borealis: ThemeTokens = {
  id: "borealis",
  palette: {
    bg0: "#051510",
    bg1: "#0A211A",
    surfaceTint: "#7FD6B2",
    text1: "#EAFBF2",
    text2: "#8FB5A4",
    accent1: "#4DF5A5",
    accent2: "#2BD9C8",
    positive: "#5EF08F",
    negative: "#FF6E5E",
  },
  type: {
    display: "Space Grotesk",
    data: "Geist Mono",
    scaleRatio: 1.5,
  },
  shape: {
    radius: 14,
    border: "glow",
    blur: true,
  },
  motion: {
    dialect: "calm",
    speed: 1,
  },
  background: {
    engine: "borealis",
    params: { flow: 1, breath: 0.5, intensity: 1 },
  },
  density: "normal",
};
