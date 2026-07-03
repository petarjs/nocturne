"use client";

import { motion, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMotionDialect } from "@/lib/motion-context";
import { valueSpring, valueUpdateFlavor } from "@/lib/dialects";

// The `value` primitive (§7.1): tabular digits that roll to a new value,
// never jump. Dialect flavors the update verb (§4.3).
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
  const dialect = useMotionDialect();
  const flavor = valueUpdateFlavor(dialect);
  const springConfig = valueSpring(dialect);
  const spring = useSpring(value, springConfig);
  const flickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [inkLift, setInkLift] = useState(false);

  useEffect(() => {
    if (flickerRef.current) {
      clearInterval(flickerRef.current);
      flickerRef.current = null;
    }

    if (flavor === "mechanical") {
      let step = 0;
      flickerRef.current = setInterval(() => {
        if (step < 3) {
          const jitter = value * (0.82 + Math.random() * 0.36);
          spring.set(jitter);
          step += 1;
        } else {
          spring.set(value);
          if (flickerRef.current) clearInterval(flickerRef.current);
          flickerRef.current = null;
        }
      }, 150);
      return () => {
        if (flickerRef.current) clearInterval(flickerRef.current);
      };
    }

    if (flavor === "ink") {
      setInkLift(true);
      spring.set(value);
      const timer = setTimeout(() => setInkLift(false), 550);
      return () => clearTimeout(timer);
    }

    spring.set(value);
  }, [value, flavor, spring]);

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
      animate={{
        color: inkLift ? "var(--n-text2)" : "var(--n-text1)",
        opacity: inkLift ? 0.55 : 1,
      }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
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
