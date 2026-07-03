import type { ThemeTokens } from "@/lib/schema";

export const observatory: ThemeTokens = {
  id: "observatory",
  palette: {
    bg0: "#0A0E1A",
    bg1: "#101627",
    surfaceTint: "#8FA8C7",
    text1: "#E8EDF7",
    text2: "#93A0B8",
    accent1: "#5EEAD4",
    accent2: "#818CF8",
    positive: "#4ADE80",
    negative: "#F87171",
  },
  type: {
    display: "Sora",
    data: "Spline Sans Mono",
    scaleRatio: 1.5,
  },
  shape: {
    radius: 20,
    border: "hairline",
    blur: true,
  },
  motion: {
    dialect: "calm",
    speed: 1,
  },
  background: {
    engine: "aurora",
    preset: "observatory",
  },
  density: "normal",
};
