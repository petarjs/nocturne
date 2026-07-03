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
    // sleep mood: universal starfield tinted by theme (§4.5)
    if (mood === "sleep") return new ParticlesEngine();

    switch (engineName) {
      case "aurora":
        return new AuroraEngine();
      case "gridHorizon":
        return new GridHorizonEngine();
      case "particles":
        return new ParticlesEngine();
      case "growth":
        // growth branch is a later slice — petals carry Kanso until then (§5.6)
        return new ParticlesEngine();
      default:
        return new FlatEngine();
    }
  }
  return new FlatEngine();
}

function engineInitParams(theme: ThemeTokens, mood: Mood): EngineParams {
  if (mood === "sleep") return { preset: "starfield" };
  if (theme.background.engine === "growth") {
    return { preset: "petals", ...(theme.background.params ?? {}) };
  }
  return theme.background.params ?? {};
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
}: {
  theme: ThemeTokens;
  mood: Mood;
  tier?: 1 | 2 | 3;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BackgroundEngine | null>(null);
  const moodRef = useRef(mood);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createEngine(theme.background.engine, tier, mood);
    engineRef.current = engine;
    engine.init(canvas, theme, engineInitParams(theme, mood));

    let currentVignette = 0;
    let currentDim = 1;
    const start = performance.now();
    let lastT = 0;
    let raf = 0;

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const dt = lastT ? t - lastT : 0;
      lastT = t;

      const alert = moodRef.current === "alert";
      const targetVignette = alert ? 1 : 0;
      const targetDim = moodRef.current === "sleep" ? 0.85 : 1;
      // ~1200ms onset (§4.4 t3), scaled by theme motion speed
      const onsetSec = 1.2 / (theme.motion.speed || 1);
      const rate = Math.min(1, dt / onsetSec);
      currentVignette += (targetVignette - currentVignette) * rate;
      currentDim += (targetDim - currentDim) * rate;

      engine.setVignette(currentVignette, theme.palette.negative);
      engine.dim(currentDim);
      engine.tick(t);
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

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      momentBus.removeEventListener("moment", onMoment);
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.background.engine, theme.background.preset, theme.motion.speed, theme.palette.bg0, theme.palette.accent1, theme.palette.accent2, theme.palette.negative, tier, mood]);

  return (
    <canvas
      // remount on engine/tier change: a canvas can't switch WebGL↔2D context type in place
      key={`${tier}-${theme.background.engine}-${mood}`}
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ background: theme.palette.bg0 }}
    />
  );
}
