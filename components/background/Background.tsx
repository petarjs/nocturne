"use client";

import { useEffect, useRef } from "react";
import type { ThemeTokens, Mood } from "@/lib/schema";
import { AuroraEngine } from "@/lib/engines/aurora";
import { FlatEngine } from "@/lib/engines/flat";
import type { BackgroundEngine } from "@/lib/engines/types";
import { momentBus, type MomentEvent } from "@/lib/moments/bus";
import { HEARTBEAT_CENTER_ID } from "@/lib/heartbeat";

function createEngine(
  engineName: ThemeTokens["background"]["engine"],
  tier: 1 | 2 | 3
): BackgroundEngine {
  if (tier >= 3) {
    switch (engineName) {
      case "aurora":
        return new AuroraEngine();
      default:
        // gridHorizon / particles / phosphor / growth / deepField land in later slices
        return new FlatEngine();
    }
  }
  // tier 1-2: every theme maps to `flat` with its own palette (§4.7, §5.1)
  return new FlatEngine();
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

    const engine = createEngine(theme.background.engine, tier);
    engineRef.current = engine;
    engine.init(canvas, theme, theme.background.params ?? {});

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
      // ~1200ms onset (§4.4 t3), frame-rate independent approach to target
      const rate = Math.min(1, dt / 1.2);
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
      if (detail.tier !== "t2") return;
      const ndc = widgetCenterNdc(detail.widgetId);
      if (ndc) engine.pulse(ndc, 0.6);
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
  }, [theme.background.engine, theme.palette.bg0, theme.palette.accent1, theme.palette.accent2, tier]);

  return (
    <canvas
      // remount on engine/tier change: a canvas can't switch WebGL↔2D context type in place
      key={`${tier}-${theme.background.engine}`}
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ background: theme.palette.bg0 }}
    />
  );
}
