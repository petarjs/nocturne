"use client";

import { useEffect, useRef } from "react";
import { idleCycleSec, idlePhase, IDLE } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion-prefs";

type SeriesPoint = { t: number; v: number };

const MORPH_MS = 550;
const MAX_VISIBLE_POINTS = 300;

type Transition = {
  from: SeriesPoint[];
  to: SeriesPoint[];
  startedAt: number | null;
};

function visibleSeries(series: SeriesPoint[]): SeriesPoint[] {
  const capped = series.length > MAX_VISIBLE_POINTS ? series.slice(-MAX_VISIBLE_POINTS) : series;
  const ordered = capped.every((point, index) => index === 0 || point.t >= capped[index - 1].t);
  return ordered ? capped : [...capped].sort((a, b) => a.t - b.t);
}

function interpolateSeries(from: SeriesPoint[], to: SeriesPoint[], progress: number): SeriesPoint[] {
  if (from.length === 0 || progress >= 1) return to;
  const length = Math.max(from.length, to.length);
  const points: SeriesPoint[] = [];

  for (let i = 0; i < length; i++) {
    const fromPoint = from[Math.min(i, from.length - 1)] ?? to[0] ?? { t: i, v: 0 };
    const toPoint = to[Math.min(i, to.length - 1)] ?? fromPoint;
    points.push({
      t: fromPoint.t + (toPoint.t - fromPoint.t) * progress,
      v: fromPoint.v + (toPoint.v - fromPoint.v) * progress,
    });
  }

  return points;
}

function transitionProgress(transition: Transition, now: number, reducedMotion: boolean): number {
  if (reducedMotion || transition.startedAt === null) return 1;
  return Math.min(1, Math.max(0, (now - transition.startedAt) / MORPH_MS));
}

export function Chart({
  series,
  variant = "area",
  color = "var(--n-accent1)",
  className = "",
  id = "chart",
  label = "Timeseries chart",
}: {
  series: SeriesPoint[];
  variant?: "area" | "line";
  color?: string;
  className?: string;
  id?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialSeries = visibleSeries(series);
  const transitionRef = useRef<Transition>({
    from: initialSeries,
    to: initialSeries,
    startedAt: null,
  });
  const rafRef = useRef(0);
  const { reducedMotion } = useMotionPrefs();
  const phase = idlePhase(id);
  const cycle = idleCycleSec(id);

  useEffect(() => {
    const next = visibleSeries(series);
    const transition = transitionRef.current;
    if (next === transition.to) return;

    const now = performance.now();
    const current = interpolateSeries(
      transition.from,
      transition.to,
      transitionProgress(transition, now, reducedMotion)
    );
    transitionRef.current = reducedMotion
      ? { from: next, to: next, startedAt: null }
      : { from: current, to: next, startedAt: now };
  }, [series, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const pixelWidth = Math.round(w * dpr);
      const pixelHeight = Math.round(h * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const transition = transitionRef.current;
      const morphT = transitionProgress(transition, now, reducedMotion);
      const interpolated = interpolateSeries(transition.from, transition.to, morphT);

      if (morphT >= 1 && transition.startedAt !== null) {
        transitionRef.current = { from: transition.to, to: transition.to, startedAt: null };
      }

      ctx.clearRect(0, 0, w, h);
      if (interpolated.length < 2) return;

      const values = interpolated.map((p) => p.v);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;
      const padY = 4;

      const firstT = interpolated[0]?.t ?? 0;
      const lastT = interpolated[interpolated.length - 1]?.t ?? firstT;
      const timeSpan = lastT - firstT;
      const coords = interpolated.map((p, i) => ({
        x: timeSpan > 0 ? ((p.t - firstT) / timeSpan) * w : (i / (interpolated.length - 1)) * w,
        y: padY + (h - padY * 2) * (1 - (p.v - min) / span),
      }));

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

      ctx.beginPath();
      coords.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      const tip = coords[coords.length - 1];
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
  }, [variant, color, reducedMotion, phase, cycle]);

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full ${className}`}
      role="img"
      aria-label={label}
      data-series-length={Math.min(series.length, MAX_VISIBLE_POINTS)}
    />
  );
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
