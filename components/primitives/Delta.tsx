"use client";

import { motion, AnimatePresence } from "motion/react";

// The `delta` primitive (§7.1): signed chip, positive/negative colored,
// flips and flashes on update — never linear (§2.3 rule 8).
export function Delta({ value, unit = "%" }: { value: number; unit?: string }) {
  const positive = value >= 0;
  const color = positive ? "var(--n-positive)" : "var(--n-negative)";

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ opacity: 0, y: positive ? 4 : -4, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="n-data inline-flex items-center gap-1 text-[14px]"
        style={{ color }}
      >
        {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}
        {unit}
      </motion.span>
    </AnimatePresence>
  );
}
