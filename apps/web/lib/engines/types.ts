import type { ThemeTokens, Mood } from "@nocturne/core";

export type EngineParams = Record<string, number | string>;

/**
 * The background contract (§5.1). Every engine implements this so the
 * moment system, moods, and themes work identically regardless of which
 * shader is mounted.
 */
export interface BackgroundEngine {
  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams): void;
  /** Update palette-driven uniforms without tearing down the WebGL/canvas context. */
  syncTheme(theme: ThemeTokens): void;
  tick(t: number): void;
  /** moment ripple, NDC origin (-1..1), ≤4 concurrent (§4.4) */
  pulse(originNdc: [number, number], strength: number): void;
  /** alert bleed at screen edges (§4.4 t3) */
  setVignette(v: number, color: string): void;
  /** focus / sleep dimming */
  dim(v: number): void;
  setMood(mood: Mood): void;
  setParams(p: EngineParams): void;
  resize(): void;
  dispose(): void;
  minTier: 1 | 2 | 3;
}
