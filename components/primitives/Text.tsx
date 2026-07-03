"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { enterTransition } from "@/lib/dialects";
import { useMotionDialect } from "@/lib/motion-context";

// The `text` primitive (§7.1): display face, masked word-stagger rise on update.
export function Text({
  text,
  className = "",
  style,
  maxLines = 2,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  maxLines?: number;
}) {
  const dialect = useMotionDialect();
  const [renderKey, setRenderKey] = useState(text);
  const words = renderKey.split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (text !== renderKey) setRenderKey(text);
  }, [text, renderKey]);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={renderKey}
        className={className}
        style={{
          fontFamily: "var(--n-font-display)",
          lineHeight: 1.2,
          display: "-webkit-box",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          ...style,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {words.map((word, i) => (
          <motion.span
            key={`${renderKey}-${i}`}
            className="inline-block"
            initial={{ opacity: 0, y: 10, filter: dialect === "ink" ? "blur(3px)" : "blur(0px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={enterTransition(dialect, i)}
          >
            {word}
            {i < words.length - 1 ? "\u00a0" : ""}
          </motion.span>
        ))}
      </motion.p>
    </AnimatePresence>
  );
}
