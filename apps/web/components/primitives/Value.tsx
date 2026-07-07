"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMotionDialect } from "@/lib/motion-context";
import { useMomentFlash } from "@/lib/moment-flash-context";
import { valueSpring, valueUpdateFlavor } from "@/lib/dialects";

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
  fontSize?: number;
  className?: string;
}) {
  const dialect = useMotionDialect();
  const flash = useMomentFlash();
  const flavor = valueUpdateFlavor(dialect);
  const springConfig = valueSpring(dialect);
  const emphasized = flash?.tier === "t2";
  const t1Pulse = flash?.tier === "t1";

  // motion v12 useSpring only tracks prop changes when the source is a
  // MotionValue — a bare number is snapshotted once in attachFollow.
  const source = useMotionValue(value);
  const springOptions = useMemo(
    () => ({
      stiffness: emphasized ? springConfig.stiffness * 1.4 : springConfig.stiffness,
      damping: emphasized ? springConfig.damping * 0.75 : springConfig.damping,
    }),
    [emphasized, springConfig.damping, springConfig.stiffness]
  );
  const spring = useSpring(source, springOptions);

  const flickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevValueRef = useRef(value);
  const [inkLift, setInkLift] = useState(false);
  const [inkBleed, setInkBleed] = useState(false);
  const [text, setText] = useState(() => value.toFixed(decimals));

  useLayoutEffect(() => {
    const format = (v: number) => setText(v.toFixed(decimals));
    format(spring.get());
    return spring.on("change", format);
  }, [spring, decimals]);

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
          source.set(jitter);
          step += 1;
        } else {
          source.set(value);
          if (flickerRef.current) clearInterval(flickerRef.current);
          flickerRef.current = null;
        }
      }, 150);
      return () => {
        if (flickerRef.current) clearInterval(flickerRef.current);
      };
    }

    if (flavor === "ink" && prevValueRef.current !== value) {
      setInkLift(true);
      setInkBleed(true);
      source.set(value);
      const timer = setTimeout(() => {
        setInkLift(false);
        setInkBleed(false);
      }, 550);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }

    prevValueRef.current = value;
    source.set(value);
  }, [value, flavor, source]);

  const sizeVar = {
    "value-s": "var(--n-value-s)",
    "value-m": "var(--n-value-m)",
    "value-l": "var(--n-value-l)",
    "value-hero": "var(--n-value-hero)",
  }[size];

  return (
    <motion.span
      className={`n-data ${className}`}
      initial={false}
      animate={{
        color: emphasized
          ? "var(--n-accent1)"
          : inkLift
            ? "var(--n-text2)"
            : t1Pulse
              ? "var(--n-accent1)"
              : "var(--n-text1)",
        opacity: inkLift ? 0.55 : t1Pulse ? [1, 0.85, 1] : 1,
        scale: t1Pulse ? [1, 1.04, 1] : emphasized ? [1, 1.03, 1] : 1,
        clipPath: inkBleed
          ? ["circle(0% at 50% 50%)", "circle(150% at 50% 50%)"]
          : "circle(150% at 50% 50%)",
      }}
      transition={{
        duration: t1Pulse ? 0.4 : emphasized ? 0.55 : 0.55,
        ease: [0.4, 0, 0.2, 1],
      }}
      style={{
        fontSize: fontSize ?? sizeVar,
        fontWeight: size === "value-hero" ? 400 : 500,
        lineHeight: 1,
        display: "inline-block",
      }}
    >
      {text}
    </motion.span>
  );
}
