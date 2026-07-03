"use client";

import { motion, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";

// The `value` primitive (§7.1): tabular digits that roll to a new value,
// never jump. Every numeric value in the product goes through this.
export function Value({
  value,
  decimals = 0,
  size = "value-m",
  fontSize,
  className = "",
}: {
  value: number;
  decimals?: number;
  size?: "value-s" | "value-m" | "value-l" | "value-hero";
  /** Explicit px size — overrides the `size` token (used when sizing to a container). */
  fontSize?: number;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 170, damping: 26 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const formatted = useTransform(spring, (v) => v.toFixed(decimals));
  const [text, setText] = useState(() => value.toFixed(decimals));

  useMotionValueEvent(formatted, "change", setText);

  const sizeVar = {
    "value-s": "var(--n-value-s)",
    "value-m": "var(--n-value-m)",
    "value-l": "var(--n-value-l)",
    "value-hero": "var(--n-value-hero)",
  }[size];

  return (
    <motion.span
      className={`n-data ${className}`}
      style={{
        fontSize: fontSize ?? sizeVar,
        fontWeight: size === "value-hero" ? 400 : 500,
        lineHeight: 1,
      }}
    >
      {text}
    </motion.span>
  );
}
