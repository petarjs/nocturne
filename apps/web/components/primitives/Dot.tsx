"use client";

import { motion } from "motion/react";
import { idleCycleSec, idlePhase } from "@/lib/idle";

type DotState = "up" | "down" | "degraded";

const dotSize = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3 w-3" } as const;

export function Dot({
  state,
  size = "sm",
  id = "dot",
}: {
  state: DotState;
  size?: keyof typeof dotSize;
  id?: string;
}) {
  const color =
    state === "up" ? "var(--n-positive)" : state === "down" ? "var(--n-negative)" : "var(--n-accent1)";
  const phase = idlePhase(id);
  const cycle = idleCycleSec(id);

  return (
    <motion.span
      key={state}
      className={`inline-block shrink-0 rounded-full ${dotSize[size]}`}
      style={{ background: color }}
      initial={{ scaleX: 0.4, opacity: 0.6 }}
      animate={{
        scaleX: 1,
        opacity: state === "degraded" ? [0.5, 1, 0.5] : 1,
      }}
      transition={
        state === "degraded"
          ? {
              opacity: {
                duration: cycle,
                repeat: Infinity,
                ease: "easeInOut",
                delay: phase % cycle,
              },
              scaleX: { type: "spring", stiffness: 300, damping: 24 },
            }
          : { type: "spring", stiffness: 300, damping: 24 }
      }
    />
  );
}
