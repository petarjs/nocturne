"use client";

import { useEffect, useRef } from "react";
import type { ThemeTokens } from "@/lib/schema";
import { AuroraEngine } from "@/lib/engines/aurora";
import type { BackgroundEngine } from "@/lib/engines/types";

function createEngine(engineName: ThemeTokens["background"]["engine"]): BackgroundEngine | null {
  switch (engineName) {
    case "aurora":
      return new AuroraEngine();
    default:
      // gridHorizon / particles / phosphor / growth / deepField / flat land in later slices
      return null;
  }
}

export function Background({ theme }: { theme: ThemeTokens }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BackgroundEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createEngine(theme.background.engine);
    engineRef.current = engine;
    if (!engine) return;

    engine.init(canvas, theme, theme.background.params ?? {});

    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      engine.tick((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.background.engine, theme.palette.bg0, theme.palette.accent1, theme.palette.accent2]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 h-full w-full"
      style={{ background: theme.palette.bg0 }}
    />
  );
}
