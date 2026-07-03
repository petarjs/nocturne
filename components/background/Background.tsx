"use client";

import { useEffect, useRef } from "react";
import type { ThemeTokens, Mood } from "@/lib/schema";
import { AuroraEngine } from "@/lib/engines/aurora";
import { FlatEngine } from "@/lib/engines/flat";
import { GridHorizonEngine } from "@/lib/engines/gridHorizon";
import { ParticlesEngine } from "@/lib/engines/particles";
import type { BackgroundEngine, EngineParams } from "@/lib/engines/types";
import { momentBus, type MomentEvent } from "@/lib/moments/bus";
import { HEARTBEAT_CENTER_ID } from "@/lib/heartbeat";

function createEngine(
  engineName: ThemeTokens["background"]["engine"],
  tier: 1 | 2 | 3,
  mood: Mood
): BackgroundEngine {
  if (tier >= 2) {
    if (mood === "sleep") return new ParticlesEngine();

    switch (engineName) {
      case "aurora":
        return new AuroraEngine();
      case "gridHorizon":
        return new GridHorizonEngine();
      case "particles":
        return new ParticlesEngine();
      case "growth":
        return new ParticlesEngine();
      default:
        return new FlatEngine();
    }
  }
  return new FlatEngine();
}

function engineInitParams(theme: ThemeTokens, mood: Mood, tier: 1 | 2 | 3): EngineParams {
  const base: EngineParams = { tier };
  if (mood === "sleep") return { ...base, preset: "starfield" };
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
  const engineRef = useRef<BackgroundEngine | null>(null);
  const overlayEngineRef = useRef<BackgroundEngine | null>(null);
  const moodRef = useRef(mood);
  const morphRef = useRef({ morphActive, bgT, morphFrom, morphTo });

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    morphRef.current = { morphActive, bgT, morphFrom, morphTo };
  }, [morphActive, bgT, morphFrom, morphTo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;

    const engine = createEngine(theme.background.engine, tier, mood);
    engineRef.current = engine;
    engine.init(canvas, theme, engineInitParams(theme, mood, tier));

    let currentVignette = 0;
    let currentDim = 1;
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
      const targetVignette = alert ? 1 : 0;
      const targetDim = m === "sleep" ? 0.85 : focus ? 0.7 : 1;
      const onsetSec = 1.2 / (theme.motion.speed || 1);
      const rate = Math.min(1, dt / onsetSec);
      currentVignette += (targetVignette - currentVignette) * rate;
      currentDim += (targetDim - currentDim) * rate;

      engine.setVignette(currentVignette, theme.palette.negative);
      engine.dim(currentDim);
      engine.tick(t);

      const { morphActive: morphing, bgT: bgMorph, morphFrom: from, morphTo: to } = morphRef.current;
      if (overlay && overlayEngineRef.current && morphing && from && to && bgMorph > 0) {
        overlayEngineRef.current.setVignette(currentVignette, to.palette.negative);
        overlayEngineRef.current.dim(currentDim);
        overlayEngineRef.current.tick(t);
        overlay.style.opacity = String(bgMorph);
      } else if (overlay) {
        overlay.style.opacity = "0";
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMoment = (e: Event) => {
      const detail = (e as CustomEvent<MomentEvent>).detail;
      if (detail.tier !== "t2" && detail.tier !== "t3") return;
      const ndc = widgetCenterNdc(detail.widgetId);
      if (ndc) engine.pulse(ndc, detail.tier === "t3" ? 0.85 : 0.6);
    };
    momentBus.addEventListener("moment", onMoment);

    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
      overlayEngineRef.current?.resize();
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      momentBus.removeEventListener("moment", onMoment);
      engine.dispose();
      overlayEngineRef.current?.dispose();
      overlayEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme.background.engine,
    theme.background.preset,
    theme.motion.speed,
    theme.palette.bg0,
    theme.palette.accent1,
    theme.palette.accent2,
    theme.palette.negative,
    tier,
    mood,
  ]);

  // Overlay engine for theme-morph cross-fade (§4.2, §6.5)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !morphActive || !morphFrom || !morphTo) {
      overlayEngineRef.current?.dispose();
      overlayEngineRef.current = null;
      return;
    }

    const engine = createEngine(morphTo.background.engine, tier, mood);
    overlayEngineRef.current = engine;
    engine.init(overlay, morphTo, engineInitParams(morphTo, mood, tier));
    overlay.style.opacity = "0";

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(overlay);
    return () => {
      ro.disconnect();
      engine.dispose();
      if (overlayEngineRef.current === engine) overlayEngineRef.current = null;
    };
  }, [morphActive, morphFrom, morphTo, tier, mood]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      <canvas
        key={`${tier}-${theme.background.engine}-${mood}`}
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ background: theme.palette.bg0 }}
      />
      <canvas
        ref={overlayRef}
        aria-hidden
        className="absolute inset-0 h-full w-full transition-opacity duration-75"
        style={{ background: morphTo?.palette.bg0 ?? theme.palette.bg0, opacity: 0 }}
      />
    </div>
  );
}
