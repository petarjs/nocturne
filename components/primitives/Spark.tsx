"use client";

import { motion } from "motion/react";
import { useId, useMemo, useRef, useState, useEffect } from "react";

// The `spark` primitive (§7.1): a 60-point micro line, extends with a tip
// pulse on update. Drawn, never appearing instantly (§2.1).
export function Spark({
  points,
  width = 120,
  height = 32,
  color = "var(--n-accent1)",
  fill = false,
  className = "",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  /** When true, sizes to the parent container (archetype slot geometry). */
  fill?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width, height });

  useEffect(() => {
    if (!fill || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setDims({ width: Math.max(40, w), height: Math.max(20, h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const w = fill ? dims.width : width;
  const h = fill ? dims.height : height;

  const { path, tip } = useMemo(() => {
    if (points.length < 2) return { path: "", tip: [0, 0] as [number, number] };
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const coords = points.map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return [x, y] as [number, number];
    });
    const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { path: d, tip: coords[coords.length - 1] };
  }, [points, w, h]);

  if (!path) return null;

  const svg = (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.circle
        cx={tip[0]}
        cy={tip[1]}
        r={2.5}
        fill={color}
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );

  if (fill) {
    return (
      <div ref={containerRef} className={className}>
        {svg}
      </div>
    );
  }

  return svg;
}
