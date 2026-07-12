"use client";

import { motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion-prefs";

function glyphKind(condition: string): "clear" | "rain" | "snow" | "storm" | "cloud" {
  const value = condition.toLowerCase();
  if (value.includes("storm") || value.includes("thunder")) return "storm";
  if (value.includes("rain") || value.includes("drizzle")) return "rain";
  if (value.includes("snow") || value.includes("sleet")) return "snow";
  if (value.includes("clear") || value.includes("sun")) return "clear";
  return "cloud";
}

/** Abstract stroke glyph: weather instrumentation, never a cartoon icon. */
export function WeatherGlyph({ condition, size = 84 }: { condition: string; size?: number }) {
  const { reducedMotion } = useMotionPrefs();
  const kind = glyphKind(condition);
  const draw = reducedMotion
    ? { pathLength: 1, opacity: 1 }
    : { pathLength: [0.85, 1, 0.85], opacity: [0.65, 1, 0.65] };

  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={condition}>
      {kind === "clear" ? (
        <>
          <motion.circle cx="48" cy="48" r="15" fill="none" stroke="var(--n-accent1)" strokeWidth="2.5" animate={draw} transition={{ duration: 7, repeat: Infinity }} />
          {[0, 45, 90, 135].map((angle) => (
            <line key={angle} x1="48" y1="16" x2="48" y2="25" stroke="var(--n-text2)" strokeWidth="2" transform={`rotate(${angle} 48 48)`} />
          ))}
        </>
      ) : (
        <>
          <motion.path
            d="M24 57c-8 0-13-5-13-12s5-12 13-12c3-11 12-17 23-17 13 0 23 9 24 22 8 0 14 5 14 12s-6 12-14 12H24"
            fill="none"
            stroke="var(--n-accent1)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={draw}
            transition={{ duration: 8, repeat: Infinity }}
          />
          {(kind === "rain" || kind === "storm") && (
            <path d="m31 70-5 10m21-10-5 10m21-10-5 10" stroke="var(--n-text2)" strokeWidth="2" strokeLinecap="round" />
          )}
          {kind === "snow" && (
            <path d="M28 70v12m-5-6h10m17-6v12m-5-6h10m17-6v12m-5-6h10" stroke="var(--n-text2)" strokeWidth="1.8" strokeLinecap="round" />
          )}
          {kind === "storm" && (
            <path d="M51 65 42 79h8l-4 11 13-17h-8z" fill="var(--n-accent1)" />
          )}
        </>
      )}
    </svg>
  );
}
