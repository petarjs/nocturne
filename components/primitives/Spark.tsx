"use client";

import { motion } from "motion/react";
import { useId, useMemo } from "react";

// The `spark` primitive (§7.1): a 60-point micro line, extends with a tip
// pulse on update. Drawn, never appearing instantly (§2.1).
export function Spark({
  points,
  width = 120,
  height = 32,
  color = "var(--n-accent1)",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const gradientId = useId();

  const { path, tip } = useMemo(() => {
    if (points.length < 2) return { path: "", tip: [0, 0] as [number, number] };
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const coords = points.map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return [x, y] as [number, number];
    });
    const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { path: d, tip: coords[coords.length - 1] };
  }, [points, width, height]);

  if (!path) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
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
}
