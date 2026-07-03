"use client";

import { motion, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";

// The `value` primitive (§7.1): tabular digits that roll to a new value,
// never jump. Every numeric value in the product goes through this.
export function Value({
  value,
  decimals = 0,
  size = "value-m",
  className = "",
}: {
  value: number;
  decimals?: number;
  size?: "value-s" | "value-m" | "value-l" | "value-hero";
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 170, damping: 26 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const formatted = useTransform(spring, (v) => v.toFixed(decimals));
  const [text, setText] = useState(() => value.toFixed(decimals));

  useMotionValueEvent(formatted, "change", setText);

  const sizePx = { "value-s": 28, "value-m": 44, "value-l": 76, "value-hero": 132 }[size];

  return (
    <motion.span
      className={`n-data ${className}`}
      style={{ fontSize: sizePx, fontWeight: size === "value-hero" ? 400 : 500, lineHeight: 1 }}
    >
      {text}
    </motion.span>
  );
}
