import type { ThemeTokens } from "@/lib/schema";
import { observatory, kanso, noir } from "@/lib/themes";

/** Canned vibe outputs for the drawer stub (§10) — no LLM yet. */
export const rainyTokyo: ThemeTokens = {
  id: "rainy-tokyo",
  palette: {
    bg0: "#080C14",
    bg1: "#0E1520",
    surfaceTint: "#6B8CAE",
    text1: "#E4ECF4",
    text2: "#7A8FA3",
    accent1: "#FF6B9D",
    accent2: "#4FC3F7",
    positive: "#66BB6A",
    negative: "#EF5350",
  },
  type: {
    display: "Sora",
    data: "Spline Sans Mono",
    scaleRatio: 1.5,
  },
  shape: {
    radius: 14,
    border: "glow",
    blur: true,
  },
  motion: {
    dialect: "chromatic",
    speed: 1.1,
  },
  background: {
    engine: "aurora",
    preset: "observatory",
  },
  density: "airy",
};

export const vibePresets: { id: string; label: string; blurb: string; theme: ThemeTokens }[] = [
  { id: "observatory", label: "Observatory", blurb: "default instrument panel", theme: observatory },
  { id: "kanso", label: "Kanso", blurb: "sumi ink at night", theme: kanso },
  { id: "noir", label: "Noir", blurb: "street-level neon", theme: noir },
  { id: "rainy-tokyo", label: "Rainy Tokyo", blurb: "canned vibe stub", theme: rainyTokyo },
];
