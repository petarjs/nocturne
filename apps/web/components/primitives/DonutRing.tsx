"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { idleCycleSec, idlePhase } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion-prefs";
import { useMomentFlash } from "@/lib/moment-flash-context";

type Segment = { label: string; value: number };

// Part of the `chart` primitive family (§7.1) — donut variant. Segments ramp
// a single accent's opacity (§2.3 rule 4) rather than using a rainbow palette.
const RAMP = [1, 0.7, 0.5, 0.35, 0.25];

export function DonutRing({
  segments,
  size = 120,
  strokeWidth,
  color = "var(--n-accent1)",
  id = "donut",
}: {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  color?: string;
  id?: string;
}) {
  const { reducedMotion } = useMotionPrefs();
  const flash = useMomentFlash();
  const t1Pulse = flash?.tier === "t1";
  const sw = strokeWidth ?? Math.max(6, Math.round(size * 0.12));
  const radius = (size - sw) / 2;
  const total = Math.max(1, segments.reduce((a, s) => a + Math.max(0, s.value), 0));
  const phase = idlePhase(id);
  const cycle = idleCycleSec(id);

  const fractions = useMemo(() => {
    const out: (Segment & { frac: number; start: number })[] = [];
    let acc = 0;
    for (const s of segments) {
      const frac = Math.max(0, s.value) / total;
      out.push({ ...s, frac, start: acc });
      acc += frac;
    }
    return out;
  }, [segments, total]);

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      animate={{ opacity: reducedMotion ? 1 : [0.97, 1, 0.97] }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: cycle, repeat: Infinity, ease: "easeInOut", delay: phase % cycle }
      }
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      {fractions.map((s, i) => (
        <motion.circle
          key={`${s.label}-${i}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`color-mix(in srgb, ${color} ${Math.round(RAMP[i % RAMP.length] * 100)}%, transparent)`}
          strokeWidth={sw}
          initial={false}
          animate={{
            pathLength: s.frac,
            pathOffset: s.start,
            opacity: t1Pulse ? [1, 0.7, 1] : 1,
          }}
          transition={{
            pathLength: { type: "spring", stiffness: 120, damping: 22 },
            pathOffset: { type: "spring", stiffness: 120, damping: 22 },
            opacity: { duration: 0.4 },
          }}
        />
      ))}
    </motion.svg>
  );
}
