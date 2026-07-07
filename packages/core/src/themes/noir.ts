import type { ThemeTokens } from "../schema";

export const noir: ThemeTokens = {
  id: "noir",
  palette: {
    bg0: "#0B0A12",
    bg1: "#14121F",
    surfaceTint: "#9D8FC7",
    text1: "#EDEAF5",
    text2: "#8E87A3",
    accent1: "#22D3EE",
    accent2: "#F0ABFC",
    positive: "#34D399",
    negative: "#FB7185",
  },
  type: {
    display: "Chakra Petch",
    data: "IBM Plex Mono",
    scaleRatio: 1.5,
  },
  shape: {
    radius: 8,
    border: "glow",
    blur: true,
  },
  motion: {
    dialect: "mechanical",
    speed: 1,
  },
  background: {
    engine: "gridHorizon",
  },
  density: "normal",
};
