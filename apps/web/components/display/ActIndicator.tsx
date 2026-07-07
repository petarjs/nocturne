"use client";

import { motion } from "motion/react";

/** 2px hairline at the bottom edge filling over the dwell (§6.3). */
export function ActIndicator({
  progress,
  pulse,
}: {
  progress: number;
  pulse: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[2px] bg-white/[0.06]">
      <motion.div
        className="h-full bg-white/20"
        animate={{
          width: `${Math.max(0, Math.min(100, progress * 100))}%`,
          opacity: pulse ? 0.55 : 0.2,
        }}
        transition={{ width: { duration: 0.08, ease: "linear" }, opacity: { duration: 0.2 } }}
      />
    </div>
  );
}
