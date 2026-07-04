"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { heartbeatBus } from "@/lib/heartbeat-events";

const MIN_INTERVAL_MS = 120_000;

// Shared across instances and remounts (e.g. when the hero changes) so the
// §4.3 "≥120s apart" invariant holds globally, not per component. The heartbeat
// (§4.6) is the sole scheduler; this component only reacts and enforces spacing.
let lastFiredAt = -Infinity;

/**
 * Noir mechanical signature (§4.3): a single-line scan glitch on the hero,
 * at most once per two minutes. Fired only by the heartbeat flourish (§4.6);
 * no self-scheduler, so two sources can never collide.
 */
export function ScanGlitch({
  enabled,
  widgetId,
}: {
  enabled: boolean;
  widgetId: string;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const onHeartbeat = (e: Event) => {
      const detail = (e as CustomEvent<{ widgetId: string }>).detail;
      if (detail.widgetId !== widgetId) return;
      const now = performance.now();
      if (now - lastFiredAt < MIN_INTERVAL_MS) return;
      lastFiredAt = now;
      setActive(true);
      setTimeout(() => setActive(false), 140);
    };

    heartbeatBus.addEventListener("scan-glitch", onHeartbeat);
    return () => heartbeatBus.removeEventListener("scan-glitch", onHeartbeat);
  }, [enabled, widgetId]);

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
