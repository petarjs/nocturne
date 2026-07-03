"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const MIN_INTERVAL_MS = 120_000;

/**
 * Noir mechanical signature (§4.3): a single-line scan glitch on the hero,
 * at most once per two minutes.
 */
export function ScanGlitch({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        setActive(true);
        setTimeout(() => {
          setActive(false);
          schedule();
        }, 140);
      }, MIN_INTERVAL_MS + Math.random() * 20_000);
    };

    schedule();
    return () => clearTimeout(timeout);
  }, [enabled]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.04 }}
        >
          <motion.div
            className="absolute inset-x-0 h-px bg-[var(--n-accent1)] opacity-90 shadow-[0_0_12px_var(--n-accent1)]"
            initial={{ top: "12%" }}
            animate={{ top: ["12%", "78%", "44%"] }}
            transition={{ duration: 0.12, ease: "linear" }}
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, var(--n-accent1) 2px, var(--n-accent1) 3px)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
