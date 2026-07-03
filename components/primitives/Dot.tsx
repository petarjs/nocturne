"use client";

import { motion } from "motion/react";

type DotState = "up" | "down" | "degraded";

// The `dot` primitive (§7.1): status point — scale flip on change, slow pulse
// when degraded.
export function Dot({ state }: { state: DotState }) {
  const color =
    state === "up" ? "var(--n-positive)" : state === "down" ? "var(--n-negative)" : "var(--n-accent1)";

  return (
    <motion.span
      key={state}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
      initial={{ scaleX: 0.4, opacity: 0.6 }}
      animate={{
        scaleX: 1,
        opacity: state === "degraded" ? [0.5, 1, 0.5] : 1,
      }}
      transition={
        state === "degraded"
          ? { opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" }, scaleX: { type: "spring", stiffness: 300, damping: 24 } }
          : { type: "spring", stiffness: 300, damping: 24 }
      }
    />
  );
}
