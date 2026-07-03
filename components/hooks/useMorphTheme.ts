"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeTokens } from "@/lib/schema";
import { interpolateTheme, THEME_MORPH_MS, themeMorphEase } from "@/lib/theme/interpolate";

/** Orchestrated 1.6s theme morph (§4.2, §6.5) — tokens interpolate, no flash. */
export function useMorphTheme(theme: ThemeTokens, reducedMotion: boolean): ThemeTokens {
  const [display, setDisplay] = useState(theme);
  const fromRef = useRef(theme);
  const animRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      fromRef.current = theme;
      setDisplay(theme);
      return;
    }

    const from = fromRef.current;
    if (from.id === theme.id) {
      setDisplay(theme);
      fromRef.current = theme;
      return;
    }

    const start = performance.now();
    cancelAnimationFrame(animRef.current);

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / THEME_MORPH_MS);
      const t = themeMorphEase(raw);
      setDisplay(interpolateTheme(from, theme, t));
      if (raw < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = theme;
        setDisplay(theme);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [theme, reducedMotion]);

  return display;
}
