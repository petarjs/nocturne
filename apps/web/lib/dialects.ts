import type { Transition } from "motion/react";
import type { MotionDialect } from "@/lib/schema";

type MotionStyle = {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  filter?: string;
  clipPath?: string;
};

export type DialectConfig = {
  spring: { stiffness: number; damping: number };
  enterFrom: MotionStyle;
  enterTo: MotionStyle;
  exitTo: MotionStyle;
};

export type ValueUpdateFlavor = "smooth" | "ink" | "mechanical";

// §4.3 — calm enter: rise + fade only. Blur on the layout wrapper blurs all
// child content and sticks when dialect/mood changes re-trigger animate.
const calmShape = {
  enterFrom: { opacity: 0, y: 24 },
  enterTo: { opacity: 1, y: 0 },
  exitTo: { opacity: 0, scale: 0.96 },
};

const inkShape = {
  enterFrom: { opacity: 0, clipPath: "circle(0% at 50% 50%)" },
  enterTo: { opacity: 1, clipPath: "circle(150% at 50% 50%)" },
  exitTo: { opacity: 0, scale: 0.98 },
};

const mechanicalShape = {
  enterFrom: { clipPath: "inset(0 100% 0 0)", opacity: 1 },
  enterTo: { clipPath: "inset(0 0% 0 0)", opacity: 1 },
  exitTo: { opacity: 0, clipPath: "inset(0 0 100% 0)" },
};

export const dialects: Record<MotionDialect, DialectConfig> = {
  calm: { spring: { stiffness: 120, damping: 20 }, ...calmShape },
  ink: { spring: { stiffness: 80, damping: 16 }, ...inkShape },
  mechanical: { spring: { stiffness: 300, damping: 30 }, ...mechanicalShape },
  chromatic: { spring: { stiffness: 260, damping: 22 }, ...calmShape },
  terse: { spring: { stiffness: 180, damping: 26 }, ...calmShape },
  gothic: { spring: { stiffness: 100, damping: 18 }, ...calmShape },
};

export function valueUpdateFlavor(dialect: MotionDialect): ValueUpdateFlavor {
  if (dialect === "ink") return "ink";
  if (dialect === "mechanical") return "mechanical";
  return "smooth";
}

export function valueSpring(dialect: MotionDialect) {
  const { stiffness, damping } = dialects[dialect].spring;
  return { stiffness, damping };
}

// widget enter: 600ms spring, staggered 60ms per widget (§4.2)
export function enterTransition(dialect: MotionDialect, index: number): Transition {
  const { stiffness, damping } = dialects[dialect].spring;
  return { type: "spring", stiffness, damping, delay: index * 0.06 };
}

// widget exit: 250ms, fade + scale (§4.2) — a tween, not a spring
export const exitTransition: Transition = { duration: 0.25, ease: [0.4, 0, 1, 1] };
