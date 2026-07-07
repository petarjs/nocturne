"use client";

import { motion } from "motion/react";
import { useId, useMemo, useRef, useState, useEffect } from "react";
import { idleCycleSec, idlePhase, IDLE } from "@/lib/idle";
import { heartbeatBus } from "@/lib/heartbeat-events";
import { useMotionPrefs } from "@/lib/motion-prefs";

export function Spark({
  points,
  width = 120,
  height = 32,
  color = "var(--n-accent1)",
  fill = false,
  className = "",
  widgetId,
  id = "spark",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
  widgetId?: string;
  id?: string;
}) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width, height });
  const [replayKey, setReplayKey] = useState(0);
  const { reducedMotion } = useMotionPrefs();
  const phase = idlePhase(id ?? widgetId ?? "spark");
  const cycle = idleCycleSec(id ?? widgetId ?? "spark");

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

  useEffect(() => {
    if (!widgetId) return;
    const onReplay = (e: Event) => {
      const detail = (e as CustomEvent<{ widgetId: string }>).detail;
      if (detail.widgetId === widgetId) setReplayKey((k) => k + 1);
    };
    heartbeatBus.addEventListener("spark-replay", onReplay);
    return () => heartbeatBus.removeEventListener("spark-replay", onReplay);
  }, [widgetId]);

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

  const tipOpacity = reducedMotion
    ? 1
    : [1 - IDLE.opacityDelta, 1, 1 - IDLE.opacityDelta];

  const svg = (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <motion.path
        key={replayKey}
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
        animate={{ opacity: tipOpacity }}
        transition={{
          duration: cycle,
          repeat: Infinity,
          ease: "easeInOut",
          delay: phase % cycle,
        }}
      />
    </svg>
  );

  if (fill) {
    return (
      <div
        ref={containerRef}
        className={className}
        data-has-spark="true"
        data-widget-id={widgetId}
      >
        {svg}
      </div>
    );
  }

  return svg;
}
