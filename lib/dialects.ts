import type { Transition } from "motion/react";
import type { MotionDialect } from "@/lib/schema";

type MotionStyle = { opacity?: number; y?: number; scale?: number; filter?: string };

export type DialectConfig = {
  spring: { stiffness: number; damping: number };
  enterFrom: MotionStyle;
  enterTo: MotionStyle;
  exitTo: MotionStyle;
};

// §4.3 — a dialect costumes the five verbs (§4.1) via config; it never
// changes what a verb means. Only `calm` is fully choreographed in this
// slice — the rest carry their spec'd spring numbers so widgets never
// wait on a config that's genuinely missing, but reuse calm's enter/exit
// shape until their own signature choreography lands.
const calmShape = {
  enterFrom: { opacity: 0, y: 24, filter: "blur(8px)" },
  enterTo: { opacity: 1, y: 0, filter: "blur(0px)" },
  exitTo: { opacity: 0, scale: 0.96 },
};

export const dialects: Record<MotionDialect, DialectConfig> = {
  calm: { spring: { stiffness: 120, damping: 20 }, ...calmShape },
  ink: { spring: { stiffness: 80, damping: 16 }, ...calmShape },
  mechanical: { spring: { stiffness: 300, damping: 30 }, ...calmShape },
  chromatic: { spring: { stiffness: 260, damping: 22 }, ...calmShape },
  terse: { spring: { stiffness: 180, damping: 26 }, ...calmShape },
  gothic: { spring: { stiffness: 100, damping: 18 }, ...calmShape },
};

// widget enter: 600ms spring, staggered 60ms per widget (§4.2)
export function enterTransition(dialect: MotionDialect, index: number): Transition {
  const { stiffness, damping } = dialects[dialect].spring;
  return { type: "spring", stiffness, damping, delay: index * 0.06 };
}

// widget exit: 250ms, fade + scale (§4.2) — a tween, not a spring
export const exitTransition: Transition = { duration: 0.25, ease: [0.4, 0, 1, 1] };
