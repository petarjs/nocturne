"use client";

import { motion, AnimatePresence } from "motion/react";

type Line = { t: string; text: string; level?: "info" | "warn" | "error" };

const levelColor = {
  info: "var(--n-text2)",
  warn: "var(--n-accent1)",
  error: "var(--n-negative)",
} as const;

// The `stream` primitive (§7.1): ticker line engine — new line slides up,
// older lines fade to 40% (lines are ordered newest-first).
export function Stream({
  lines,
  maxVisible = 6,
  className = "",
}: {
  lines: Line[];
  maxVisible?: number;
  className?: string;
}) {
  const visible = lines.slice(0, maxVisible);

  return (
    <div className={`flex min-h-0 flex-1 flex-col-reverse gap-1.5 overflow-hidden ${className}`}>
      <AnimatePresence initial={false}>
        {visible.map((line, i) => (
          <motion.div
            key={`${line.t}-${line.text}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: Math.max(0.4, 1 - i * 0.15), y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="flex items-baseline gap-2"
          >
            <span
              className="n-data shrink-0 tabular-nums text-[length:calc(var(--n-meta-size)*0.85)]"
              style={{ color: "var(--n-text2)" }}
            >
              {line.t}
            </span>
            <span
              className="n-data min-w-0 flex-1 truncate text-[length:var(--n-meta-size)]"
              style={{ color: levelColor[line.level ?? "info"] }}
            >
              {line.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
