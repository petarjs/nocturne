"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { idleCycleSec, idlePhase } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion-prefs";
import { useMomentFlash } from "@/lib/moment-flash-context";

export function Arc({
  fraction,
  size = 96,
  strokeWidth = 4,
  color = "var(--n-accent1)",
  trackColor = "rgba(255,255,255,0.06)",
  zones,
  id = "arc",
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  zones?: { at: number; color: string }[];
  id?: string;
}) {
  const { reducedMotion } = useMotionPrefs();
  const flash = useMomentFlash();
  const t1Pulse = flash?.tier === "t1";
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const phase = idlePhase(id);
  const cycle = idleCycleSec(id);

  const spring = useSpring(fraction, { stiffness: 140, damping: 18 });
  useEffect(() => {
    spring.set(fraction);
  }, [fraction, spring]);

  const dashoffset = useTransform(spring, (v) => circumference * (1 - Math.max(0, Math.min(1, v))));

  const tipAngle = useTransform(spring, (v) => {
    const f = Math.max(0, Math.min(1, v));
    return f * 2 * Math.PI - Math.PI / 2;
  });

  const tipX = useTransform(tipAngle, (a) => size / 2 + radius * Math.cos(a));
  const tipY = useTransform(tipAngle, (a) => size / 2 + radius * Math.sin(a));

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
        stroke={t1Pulse ? "var(--n-accent1)" : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={{ strokeDashoffset: dashoffset }}
        animate={t1Pulse ? { opacity: [1, 0.7, 1], scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 0.4 }}
      />
      {!reducedMotion && (
        <motion.circle
          r={strokeWidth * 1.2}
          fill={color}
          style={{ cx: tipX, cy: tipY }}
          animate={{
            opacity: [0.5, 0.85, 0.5],
            filter: [
              `blur(${strokeWidth * 0.5}px)`,
              `blur(${strokeWidth * 1.2}px)`,
              `blur(${strokeWidth * 0.5}px)`,
            ],
          }}
          transition={{
            duration: cycle,
            repeat: Infinity,
            ease: "easeInOut",
            delay: phase % cycle,
          }}
        />
      )}
    </svg>
  );
}
