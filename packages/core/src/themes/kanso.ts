import type { ThemeTokens } from "../schema";

export const kanso: ThemeTokens = {
  id: "kanso",
  palette: {
    bg0: "#0D0E10",
    bg1: "#16171A",
    surfaceTint: "#B8AFA4",
    text1: "#F0EBE2",
    text2: "#9A938A",
    accent1: "#E8697D",
    accent2: "#8FA88F",
    positive: "#A3C9A8",
    negative: "#D9564F",
  },
  type: {
    display: "Shippori Mincho",
    data: "M PLUS 1 Code",
    scaleRatio: 1.5,
  },
  shape: {
    radius: 4,
    border: "hairline",
    blur: false,
  },
  motion: {
    dialect: "ink",
    speed: 1,
  },
  background: {
    engine: "growth",
    preset: "petals",
  },
  density: "normal",
};
