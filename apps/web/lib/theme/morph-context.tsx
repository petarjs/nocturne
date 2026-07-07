"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ThemeTokens } from "@nocturne/core";
import { interpolateTheme, THEME_MORPH_MS, morphActs } from "@/lib/theme/interpolate";

export type ThemeMorphState = {
  theme: ThemeTokens;
  morphActive: boolean;
  progress: number;
  elapsedMs: number;
  fromTheme: ThemeTokens | null;
  toTheme: ThemeTokens;
  exitT: number;
  bgT: number;
  enterT: number;
};

const defaultState: ThemeMorphState = {
  theme: {} as ThemeTokens,
  morphActive: false,
  progress: 0,
  elapsedMs: 0,
  fromTheme: null,
  toTheme: {} as ThemeTokens,
  exitT: 0,
  bgT: 0,
  enterT: 0,
};

const ThemeMorphContext = createContext<ThemeMorphState>(defaultState);

export function ThemeMorphProvider({
  targetTheme,
  reducedMotion,
  children,
}: {
  targetTheme: ThemeTokens;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<ThemeMorphState>(() => ({
    ...defaultState,
    theme: targetTheme,
    toTheme: targetTheme,
  }));
  const fromRef = useRef(targetTheme);
  const animRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      fromRef.current = targetTheme;
      setState({
        theme: targetTheme,
        morphActive: false,
        progress: 0,
        elapsedMs: 0,
        fromTheme: null,
        toTheme: targetTheme,
        exitT: 0,
        bgT: 0,
        enterT: 0,
      });
      return;
    }

    const from = fromRef.current;
    if (from.id === targetTheme.id) {
      setState((s) => ({ ...s, theme: targetTheme, toTheme: targetTheme, morphActive: false }));
      fromRef.current = targetTheme;
      return;
    }

    const start = performance.now();
    cancelAnimationFrame(animRef.current);

    const tick = (now: number) => {
      const elapsedMs = now - start;
      const progress = Math.min(1, elapsedMs / THEME_MORPH_MS);
      const acts = morphActs(elapsedMs);
      setState({
        theme: interpolateTheme(from, targetTheme, acts.tokenT),
        morphActive: progress < 1,
        progress,
        elapsedMs,
        fromTheme: from,
        toTheme: targetTheme,
        ...acts,
      });
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = targetTheme;
        setState({
          theme: targetTheme,
          morphActive: false,
          progress: 1,
          elapsedMs: THEME_MORPH_MS,
          fromTheme: null,
          toTheme: targetTheme,
          exitT: 1,
          bgT: 1,
          enterT: 1,
        });
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [targetTheme, reducedMotion]);

  return <ThemeMorphContext.Provider value={state}>{children}</ThemeMorphContext.Provider>;
}

export function useThemeMorph(): ThemeMorphState {
  return useContext(ThemeMorphContext);
}
