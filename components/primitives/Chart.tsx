"use client";

import { useEffect, useRef } from "react";

type SeriesPoint = { t: number; v: number };

// The `chart` primitive (§7.1): area line drawn on canvas, morphs between
// datasets. Kept to ≤300 visible points (§4.7).
export function Chart({
  series,
  variant = "area",
  color = "var(--n-accent1)",
  className = "",
}: {
  series: SeriesPoint[];
  variant?: "area" | "line";
  color?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || series.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const values = series.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const padY = 4;

    const coords = series.map((p, i) => ({
      x: (i / (series.length - 1)) * w,
      y: padY + (h - padY * 2) * (1 - (p.v - min) / span),
    }));

    ctx.clearRect(0, 0, w, h);

    const accent = getComputedStyle(canvas).getPropertyValue("--n-accent1").trim() || color;

    if (variant === "area") {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, withAlpha(accent, 0.35));
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
  }, [series, variant, color]);

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} />;
}

function withAlpha(cssColor: string, alpha: number): string {
  if (cssColor.startsWith("#")) {
    const hex = cssColor.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return cssColor;
}
