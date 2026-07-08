"use client";

import { motion } from "motion/react";
import { idleCycleSec, idlePhase, IDLE } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion-prefs";
import { useMomentFlash } from "@/lib/moment-flash-context";

type Category = { label: string; value: number };

// Part of the `chart` primitive family (§7.1) — categorical variant. DOM
// springs (not canvas) since a handful of discrete bars don't need a raf loop.
export function Bars({
  categories,
  color = "var(--n-accent1)",
  className = "",
  id = "bars",
  showValues = false,
}: {
  categories: Category[];
  color?: string;
  className?: string;
  id?: string;
  showValues?: boolean;
}) {
  const { reducedMotion } = useMotionPrefs();
  const flash = useMomentFlash();
  const emphasized = flash?.tier === "t2";
  const max = Math.max(1, ...categories.map((c) => c.value));

  return (
    <div className={`flex h-full w-full items-end gap-3 ${className}`}>
      {categories.map((c, i) => {
        const phase = idlePhase(`${id}-${i}`);
        const cycle = idleCycleSec(`${id}-${i}`);
        const pct = Math.max(2, (c.value / max) * 100);
        return (
          <div key={c.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            {showValues && (
              <span
                className="n-data tabular-nums text-[length:calc(var(--n-meta-size)*0.9)]"
                style={{ color: "var(--n-text1)" }}
              >
                {Math.round(c.value)}
              </span>
            )}
            <motion.div
              className="w-full rounded-t-[4px]"
              style={{ background: color, transformOrigin: "bottom", boxShadow: emphasized ? `0 0 16px ${color}66` : "none" }}
              initial={false}
              animate={{
                height: `${pct}%`,
                opacity: emphasized
                  ? [1, 0.72, 1]
                  : reducedMotion
                    ? 1
                    : [1 - IDLE.opacityDelta, 1, 1 - IDLE.opacityDelta],
              }}
              transition={{
                height: { type: "spring", stiffness: 140, damping: 20, delay: i * 0.03 },
                opacity: emphasized
                  ? { duration: 0.4 }
                  : reducedMotion
                    ? { duration: 0 }
                    : { duration: cycle, repeat: Infinity, ease: "easeInOut", delay: phase % cycle },
              }}
            />
            <span className="n-label w-full truncate text-center leading-tight">{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}
