"use client";

import { motion, AnimatePresence } from "motion/react";

type Row = { id: string; label: string; value: string | number };

// The `rows` primitive (§7.1): list/table row engine — FLIP reorder, value
// rolls per cell. Reorder animation is simplified here; values are static text.
export function Rows({ items }: { items: Row[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 200, damping: 24, delay: i * 0.03 }}
            className="flex items-center justify-between gap-3 py-1"
          >
            <span className="n-data truncate text-[14px]" style={{ color: "var(--n-text1)" }}>
              {item.label}
            </span>
            <span className="n-data shrink-0 text-[14px]" style={{ color: "var(--n-text2)" }}>
              {item.value}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
