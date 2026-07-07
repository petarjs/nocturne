"use client";

import { useEffect, useRef } from "react";
import type { ThemeTokens, Mood } from "@nocturne/core";
import { AuroraEngine } from "@/lib/engines/aurora";
import { BorealisEngine } from "@/lib/engines/borealis";
import { FlatEngine } from "@/lib/engines/flat";
import { GridHorizonEngine } from "@/lib/engines/gridHorizon";
import { GrowthEngine } from "@/lib/engines/growth";
import { MeadowEngine } from "@/lib/engines/meadow";
import { ParticlesEngine } from "@/lib/engines/particles";
import type { BackgroundEngine, EngineParams } from "@/lib/engines/types";
import { momentBus, type MomentEvent } from "@/lib/moments/bus";
import { HEARTBEAT_CENTER_ID } from "@/lib/heartbeat";

// Sleep dissolve onset (§1.3 beat 6 / §4.2 scene morph): the starfield fades in
// over ~1.2s while the theme engine dims beneath it — never a hard cut.
const SLEEP_FADE_SEC = 1.2;

function createEngine(
  engineName: ThemeTokens["background"]["engine"],
  tier: 1 | 2 | 3
): BackgroundEngine {
  if (tier >= 2) {
    switch (engineName) {
      case "aurora":
        return new AuroraEngine();
      case "gridHorizon":
        return new GridHorizonEngine();
      case "particles":
        return new ParticlesEngine();
      case "meadow":
        return new MeadowEngine();
      case "borealis":
        return new BorealisEngine();
      case "growth":
        // §5.6 splurge. Revert this single case to `new ParticlesEngine()` for
        // the pre-authorized petals-only fallback if the beauty gate fails.
        return new GrowthEngine();
      default:
        return new FlatEngine();
    }
  }
  return new FlatEngine();
}

function engineInitParams(theme: ThemeTokens, tier: 1 | 2 | 3): EngineParams {
  const base: EngineParams = { tier };
  if (theme.background.engine === "growth") {
    return { ...base, preset: "petals", ...(theme.background.params ?? {}) };
  }
  return { ...base, ...(theme.background.params ?? {}) };
}

function widgetCenterNdc(widgetId: string): [number, number] | null {
  if (widgetId === HEARTBEAT_CENTER_ID) return [0, 0];
  const el = document.querySelector(`[data-widget-id="${widgetId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return [(cx / window.innerWidth) * 2 - 1, -((cy / window.innerHeight) * 2 - 1)];
}

export function Background({
  theme,
  mood,
  tier = 3,
  morphActive = false,
  morphFrom,
  morphTo,
  bgT = 0,
}: {
  theme: ThemeTokens;
  mood: Mood;
  tier?: 1 | 2 | 3;
  morphActive?: boolean;
  morphFrom?: ThemeTokens | null;
  morphTo?: ThemeTokens;
  bgT?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sleepRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BackgroundEngine | null>(null);
  const overlayEngineRef = useRef<BackgroundEngine | null>(null);
  const sleepEngineRef = useRef<BackgroundEngine | null>(null);
  const themeRef = useRef(theme);
  const moodRef = useRef(mood);
  const morphRef = useRef({ morphActive, bgT, morphFrom, morphTo });

  useEffect(() => {
    themeRef.current = theme;
    engineRef.current?.syncTheme(theme);
    overlayEngineRef.current?.syncTheme(morphTo ?? theme);
    sleepEngineRef.current?.syncTheme(theme);
  }, [theme, morphTo]);

  useEffect(() => {
    moodRef.current = mood;
    // engines that model weather (meadow) react to mood directly (§5.1)
    engineRef.current?.setMood(mood);
  }, [mood]);

  useEffect(() => {
    morphRef.current = { morphActive, bgT, morphFrom, morphTo };
  }, [morphActive, bgT, morphFrom, morphTo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const sleepCanvas = sleepRef.current;
    if (!canvas) return;

    const engine = createEngine(theme.background.engine, tier);
    engineRef.current = engine;
    try {
      engine.init(canvas, theme, engineInitParams(theme, tier));
    } catch {
      const fallback = new FlatEngine();
      engineRef.current = fallback;
      fallback.init(canvas, theme, engineInitParams(theme, tier));
    }
    // a remount mid-alert must come back stormy, not calm
    engineRef.current.setMood(moodRef.current);

    // Sleep starfield lives on its own overlay canvas so entering/leaving sleep
    // is a cross-fade, not an engine remount (§1.3 beat 6). Ticked only while
    // the fade is non-zero, so it costs nothing in ambient/focus/alert.
    if (sleepCanvas && tier >= 2) {
      const sleepEngine = new ParticlesEngine();
      sleepEngineRef.current = sleepEngine;
      try {
        sleepEngine.init(sleepCanvas, theme, { tier, preset: "starfield" });
      } catch {
        sleepEngineRef.current = null;
      }
    }

    let currentVignette = 0;
    let currentDim = 1;
    let sleepFade = moodRef.current === "sleep" ? 1 : 0;
    const start = performance.now();
    let lastT = 0;
    let raf = 0;

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const dt = lastT ? t - lastT : 0;
      lastT = t;

      const m = moodRef.current;
      const alert = m === "alert";
      const focus = m === "focus";
      const sleeping = m === "sleep";
      const targetVignette = alert ? 1 : 0;
      const targetDim = sleeping ? 0.85 : focus ? 0.7 : 1;
      const speed = themeRef.current.motion.speed || 1;
      const onsetSec = 1.2 / speed;
      const rate = Math.min(1, dt / onsetSec);
      currentVignette += (targetVignette - currentVignette) * rate;
      currentDim += (targetDim - currentDim) * rate;

      const activeTheme = themeRef.current;
      const activeEngine = engineRef.current;
      if (!activeEngine) return;

      activeEngine.setVignette(currentVignette, activeTheme.palette.negative);
      activeEngine.dim(currentDim);
      activeEngine.tick(t);

      const { morphActive: morphing, bgT: bgMorph, morphFrom: from, morphTo: to } = morphRef.current;
      if (overlay && overlayEngineRef.current && morphing && from && to && bgMorph > 0) {
        overlayEngineRef.current.setVignette(currentVignette, to.palette.negative);
        overlayEngineRef.current.dim(currentDim);
        overlayEngineRef.current.tick(t);
        overlay.style.opacity = String(bgMorph);
      } else if (overlay) {
        overlay.style.opacity = "0";
      }

      // Sleep dissolve: fade the starfield toward 1 in sleep, 0 otherwise.
      const targetSleep = sleeping ? 1 : 0;
      const sleepRate = Math.min(1, dt / (SLEEP_FADE_SEC / speed));
      sleepFade += (targetSleep - sleepFade) * sleepRate;
      if (Math.abs(targetSleep - sleepFade) < 0.002) sleepFade = targetSleep;
      if (sleepCanvas && sleepEngineRef.current) {
        if (sleepFade > 0.001) {
          sleepEngineRef.current.setVignette(0, activeTheme.palette.negative);
          sleepEngineRef.current.dim(currentDim);
          sleepEngineRef.current.tick(t);
        }
        sleepCanvas.style.opacity = String(sleepFade);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMoment = (e: Event) => {
      const detail = (e as CustomEvent<MomentEvent>).detail;
      if (detail.tier !== "t2" && detail.tier !== "t3") return;
      const ndc = widgetCenterNdc(detail.widgetId);
      if (ndc) engineRef.current?.pulse(ndc, detail.tier === "t3" ? 0.85 : 0.6);
    };
    momentBus.addEventListener("moment", onMoment);

    const resizeObserver = new ResizeObserver(() => {
      engineRef.current?.resize();
      overlayEngineRef.current?.resize();
      sleepEngineRef.current?.resize();
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      momentBus.removeEventListener("moment", onMoment);
      engineRef.current?.dispose();
      engineRef.current = null;
      sleepEngineRef.current?.dispose();
      sleepEngineRef.current = null;
    };
    // Engine lifecycle only — palette changes go through syncTheme, and mood is
    // read live via moodRef so sleep never remounts the base engine.
  }, [theme.background.engine, tier]);

  // Overlay engine for theme-morph cross-fade (§4.2, §6.5)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !morphActive || !morphFrom || !morphTo) {
      overlayEngineRef.current?.dispose();
      overlayEngineRef.current = null;
      return;
    }

    const engine = createEngine(morphTo.background.engine, tier);
    overlayEngineRef.current = engine;
    try {
      engine.init(overlay, morphTo, engineInitParams(morphTo, tier));
    } catch {
      const fallback = new FlatEngine();
      overlayEngineRef.current = fallback;
      fallback.init(overlay, morphTo, engineInitParams(morphTo, tier));
    }
    overlay.style.opacity = "0";

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(overlay);
    return () => {
      ro.disconnect();
      engine.dispose();
      if (overlayEngineRef.current === engine) overlayEngineRef.current = null;
    };
  }, [morphActive, morphFrom, morphTo, tier]);

  // Distinct prefixes so the base and overlay canvases never share a key even
  // when the interpolated theme already reports the morph target's id/engine.
  const overlayEngineKey =
    morphActive && morphTo
      ? `overlay-${tier}-${morphTo.background.engine}-${morphTo.id}`
      : "overlay-idle";

  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      <canvas
        key={`base-${tier}-${theme.background.engine}-${theme.id}`}
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ background: theme.palette.bg0 }}
      />
      <canvas
        key={overlayEngineKey}
        ref={overlayRef}
        aria-hidden
        className="absolute inset-0 h-full w-full transition-opacity duration-75"
        style={{ background: morphTo?.palette.bg0 ?? theme.palette.bg0, opacity: 0 }}
      />
      <canvas
        ref={sleepRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
