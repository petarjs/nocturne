"use client";

import { motion } from "motion/react";

/**
 * Bottom-center dot navigation for act rotation (§6.3) — a louder sibling
 * to the hairline indicator. The active dot draws a thin progress ring over
 * the dwell (same visual language as the clock's seconds arc) and glows;
 * idle dots breathe on a per-dot desynced phase so the row reads as alive
 * rather than a progress bar chopped into segments (§2.1/§4.2).
 */
export function ActDots({
  count,
  index,
  progress,
  pulse,
}: {
  count: number;
  index: number;
  progress: number;
  pulse: boolean;
}) {
  const size = 24;
  const r = 8;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex items-center justify-center gap-4">
      {Array.from({ length: count }).map((_, i) => {
        const active = i === index;
        const idleDuration = 5.5 + (i % 3) * 0.9;
        return (
          <div
            key={i}
            className="relative flex shrink-0 items-center justify-center"
            style={{ width: size, height: size }}
          >
            {active && (
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="absolute inset-0"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="var(--n-text1)"
                  strokeOpacity={0.1}
                  strokeWidth={1.5}
                />
                <motion.circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="var(--n-accent1)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: circumference * (1 - progress) }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </svg>
            )}
            <motion.div
              className="rounded-full"
              style={{ backgroundColor: active ? "var(--n-accent1)" : "var(--n-text2)" }}
              animate={
                active
                  ? {
                      width: 9,
                      height: 9,
                      opacity: 1,
                      scaleX: pulse ? [1, 1.45, 1] : [1, 1.08, 1],
                      scaleY: pulse ? [1, 1.45, 1] : [1, 0.93, 1],
                      boxShadow: "0 0 10px var(--n-accent1), 0 0 2px var(--n-accent1)",
                    }
                  : {
                      width: 5,
                      height: 5,
                      opacity: [0.28, 0.42, 0.28],
                      scale: [1, 1.12, 1],
                      boxShadow: "0 0 0 rgba(0,0,0,0)",
                    }
              }
              transition={
                active
                  ? {
                      width: { type: "spring", stiffness: 320, damping: 22 },
                      height: { type: "spring", stiffness: 320, damping: 22 },
                      boxShadow: { type: "spring", stiffness: 320, damping: 22 },
                      scaleX: {
                        duration: pulse ? 0.5 : idleDuration,
                        repeat: pulse ? 0 : Infinity,
                        ease: "easeInOut",
                      },
                      scaleY: {
                        duration: pulse ? 0.5 : idleDuration,
                        repeat: pulse ? 0 : Infinity,
                        ease: "easeInOut",
                      },
                    }
                  : {
                      width: { type: "spring", stiffness: 320, damping: 22 },
                      height: { type: "spring", stiffness: 320, damping: 22 },
                      opacity: {
                        duration: idleDuration,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.45,
                      },
                      scale: {
                        duration: idleDuration,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.45,
                      },
                    }
              }
            />
          </div>
        );
      })}
    </div>
  );
}
