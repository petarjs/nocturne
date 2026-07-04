"use client";

import { useEffect } from "react";
import { motion, useMotionValue } from "motion/react";
import type { MotionDialect } from "@/lib/schema";
import type { WidgetSlot } from "@/lib/layout/types";

function parallaxAmplitude(role: WidgetSlot): number {
  if (role === "hero") return 4;
  if (role === "supporting") return 3;
  return 2;
}

/** Observatory calm signature (§4.3): 2–4px soft layer parallax between widgets. */
export function CalmParallax({
  id,
  role,
  dialect,
  children,
  className = "",
}: {
  id: string;
  role: WidgetSlot;
  dialect: MotionDialect;
  children: React.ReactNode;
  className?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    if (dialect !== "calm") {
      x.set(0);
      y.set(0);
      return;
    }

    const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const amp = parallaxAmplitude(role);
    const phase = hash * 0.61;
    const start = performance.now();
    let raf = 0;

    // Periods ~15s/19s (was ~57s/74s): slow enough to read as "calm," fast
    // enough that hero/supporting/ambient layers visibly drift apart within a
    // 5s window — the calm dialect's Motion Turing tell (§4.3, criterion 6).
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      x.set(Math.sin(t * 0.42 + phase) * amp);
      y.set(Math.cos(t * 0.33 + phase * 0.7) * amp * 0.65);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, role, dialect, x, y]);

  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
}
