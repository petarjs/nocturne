"use client";

import { useMemo, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { enterTransition } from "@/lib/dialects";
import { useMotionDialect } from "@/lib/motion-context";
import { parseMdLite, type MdToken } from "@/lib/mdLite";

// The `text` primitive (§7.1): display face, masked word-stagger rise on update.
export function Text({
  text,
  className = "",
  style,
  maxLines = 2,
  markdown = false,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  maxLines?: number;
  /** md-lite (§7.3 `text` preset): **bold** / *italic* only, no other markdown. */
  markdown?: boolean;
}) {
  const dialect = useMotionDialect();
  const tokens: MdToken[] = useMemo(
    () =>
      markdown
        ? parseMdLite(text)
        : text
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => ({ text: w })),
    [text, markdown]
  );

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
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
        {tokens.map((tok, i) => (
          <motion.span
            key={`${text}-${i}`}
            className="inline-block"
            initial={{ opacity: 0, y: 10, filter: dialect === "ink" ? "blur(3px)" : "blur(0px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={enterTransition(dialect, i)}
          >
            {tok.bold ? (
              <strong style={{ fontWeight: 600 }}>{tok.text}</strong>
            ) : tok.em ? (
              <em>{tok.text}</em>
            ) : (
              tok.text
            )}
            {i < tokens.length - 1 ? "\u00a0" : ""}
          </motion.span>
        ))}
      </motion.p>
    </AnimatePresence>
  );
}
