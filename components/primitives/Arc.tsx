"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

// The `arc` primitive (§7.1): gauge sweep with a glowing tip, spring sweep
// with overshoot. `fraction` is 0..1 of the full sweep.
export function Arc({
  fraction,
  size = 96,
  strokeWidth = 4,
  color = "var(--n-accent1)",
  trackColor = "rgba(255,255,255,0.06)",
  zones,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  zones?: { at: number; color: string }[];
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const spring = useSpring(fraction, { stiffness: 140, damping: 18 });
  useEffect(() => {
    spring.set(fraction);
  }, [fraction, spring]);

  const dashoffset = useTransform(spring, (v) => circumference * (1 - Math.max(0, Math.min(1, v))));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {zones?.map((z) => (
        <circle
          key={z.at}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={z.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${1.5} ${circumference - 1.5}`}
          strokeDashoffset={circumference * (1 - z.at)}
          opacity={0.7}
        />
      ))}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={{ strokeDashoffset: dashoffset }}
      />
    </svg>
  );
}
