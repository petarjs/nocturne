"use client";

import { useEffect, useRef } from "react";
import { idleCycleSec, idlePhase, IDLE } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion-prefs";

type SeriesPoint = { t: number; v: number };

const MORPH_MS = 550;

export function Chart({
  series,
  variant = "area",
  color = "var(--n-accent1)",
  className = "",
  id = "chart",
}: {
  series: SeriesPoint[];
  variant?: "area" | "line";
  color?: string;
  className?: string;
  id?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fromSeriesRef = useRef<SeriesPoint[]>(series);
  const morphStartRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const { reducedMotion } = useMotionPrefs();
  const phase = idlePhase(id);
  const cycle = idleCycleSec(id);

  useEffect(() => {
    if (series !== fromSeriesRef.current && fromSeriesRef.current.length >= 2) {
      morphStartRef.current = performance.now();
    } else {
      fromSeriesRef.current = series;
    }
  }, [series]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = (now: number) => {
      if (series.length < 2) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let morphT = 1;
      if (morphStartRef.current !== null && !reducedMotion) {
        morphT = Math.min(1, (now - morphStartRef.current) / MORPH_MS);
        if (morphT >= 1) {
          morphStartRef.current = null;
          fromSeriesRef.current = series;
        }
      }

      const from = fromSeriesRef.current;
      const to = series;
      const maxLen = Math.max(from.length, to.length);
      const interpolated: SeriesPoint[] = [];

      for (let i = 0; i < maxLen; i++) {
        const fv = from[Math.min(i, from.length - 1)]?.v ?? to[0]?.v ?? 0;
        const tv = to[Math.min(i, to.length - 1)]?.v ?? fv;
        const ft = from[Math.min(i, from.length - 1)]?.t ?? i;
        const tt = to[Math.min(i, to.length - 1)]?.t ?? ft;
        interpolated.push({
          t: ft + (tt - ft) * morphT,
          v: fv + (tv - fv) * morphT,
        });
      }

      const values = interpolated.map((p) => p.v);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;
      const padY = 4;

      const coords = interpolated.map((p, i) => ({
        x: (i / (interpolated.length - 1)) * w,
        y: padY + (h - padY * 2) * (1 - (p.v - min) / span),
      }));

      ctx.clearRect(0, 0, w, h);

      const rawAccent = getComputedStyle(canvas).getPropertyValue("--n-accent1").trim();
      const accent = isHexColor(rawAccent) ? rawAccent : isHexColor(color) ? color : FALLBACK_HEX;

      const breathe = reducedMotion
        ? 1
        : 1 + IDLE.opacityDelta * Math.sin((now / 1000) * ((2 * Math.PI) / cycle) + phase);
      const fillAlpha = 0.35 * breathe;

      if (variant === "area") {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, withAlpha(accent, fillAlpha));
        grad.addColorStop(1, withAlpha(accent, 0));
        ctx.beginPath();
        ctx.moveTo(coords[0].x, h);
        coords.forEach(({ x, y }) => ctx.lineTo(x, y));
        ctx.lineTo(coords[coords.length - 1].x, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      const drawCount =
        morphT < 1 ? Math.max(2, Math.ceil(coords.length * morphT)) : coords.length;

      ctx.beginPath();
      coords.slice(0, drawCount).forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      const tip = coords[Math.min(drawCount - 1, coords.length - 1)];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    };

    const loop = (now: number) => {
      draw(now);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [series, variant, color, reducedMotion, phase, cycle]);

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} />;
}

const FALLBACK_HEX = "#5eead4";

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

// `accent` is validated by the caller before reaching here, but this stays
// defensive so a bad value degrades to a visible color instead of a thrown
// CanvasGradient error (a raw "var(--n-accent1)" string is not a color).
function withAlpha(cssColor: string, alpha: number): string {
  const hex = isHexColor(cssColor) ? cssColor : FALLBACK_HEX;
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
