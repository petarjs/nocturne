import { motion, AnimatePresence } from "motion/react";
import { Label } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Delta } from "@/components/primitives/Delta";
import { Dot } from "@/components/primitives/Dot";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type Column = { key: string; label: string; type: "text" | "num" | "delta" | "status" };
type Row = Record<string, string | number>;

function normalizeStatus(v: string | number): "up" | "down" | "degraded" {
  const s = String(v).toLowerCase();
  if (["down", "critical", "error", "offline"].includes(s)) return "down";
  if (["degraded", "warn", "warning"].includes(s)) return "degraded";
  return "up";
}

function Cell({ column, value }: { column: Column; value: string | number | undefined }) {
  if (value === undefined) {
    return (
      <span className="n-data text-[length:var(--n-meta-size)]" style={{ color: "var(--n-text2)" }}>
        —
      </span>
    );
  }

  if (column.type === "num") {
    const n = Number(value);
    return <Value value={n} decimals={n % 1 !== 0 ? 1 : 0} size="value-s" />;
  }

  if (column.type === "delta") {
    return <Delta value={Number(value)} />;
  }

  if (column.type === "status") {
    const state = normalizeStatus(value);
    return (
      <div className="flex items-center gap-2">
        <Dot state={state} size="sm" />
        <span
          className="n-data text-[length:calc(var(--n-meta-size)*0.9)] uppercase tracking-wider"
          style={{
            color: state === "down" ? "var(--n-negative)" : state === "degraded" ? "var(--n-accent1)" : "var(--n-text2)",
          }}
        >
          {String(value)}
        </span>
      </div>
    );
  }

  return (
    <span className="n-data truncate text-[length:var(--n-meta-size)]" style={{ color: "var(--n-text1)" }}>
      {String(value)}
    </span>
  );
}

/** tableCard archetype (§7.2): typed columns + FLIP rows. */
export function TableCard({
  slot,
  label,
  columns,
  rows,
}: {
  slot: ArchetypeSlot;
  label?: string;
  columns: Column[];
  rows: Row[];
}) {
  const pad = surfacePadForSlot[slot];
  const gridTemplate = `2fr repeat(${Math.max(1, columns.length - 1)}, 1fr)`;
  const keyOf = (row: Row, i: number) => String(row[columns[0]?.key ?? ""] ?? i);

  if (slot === "ambient") {
    const visible = rows.slice(0, 4);
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        {label && <Label className="w-16 shrink-0 leading-tight">{label}</Label>}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 overflow-hidden">
          {visible.map((row, i) => (
            <span key={keyOf(row, i)} className="flex shrink-0 items-baseline gap-1.5">
              <span className="n-data text-[12px]">{String(row[columns[0]?.key ?? ""] ?? "")}</span>
              {columns[1] && (
                <span className="n-data text-[11px]" style={{ color: "var(--n-text2)" }}>
                  {String(row[columns[1].key] ?? "")}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 overflow-hidden ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      {label && <Label>{label}</Label>}
      <div className="grid shrink-0 gap-x-3 pb-1" style={{ gridTemplateColumns: gridTemplate }}>
        {columns.map((col) => (
          <Label key={col.key} className={col.type === "text" ? "" : "text-right"}>
            {col.label}
          </Label>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <motion.div
              key={keyOf(row, i)}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 200, damping: 24, delay: i * 0.03 }}
              className="grid items-center gap-x-3 py-1"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {columns.map((col) => (
                <div key={col.key} className={col.type === "text" ? "min-w-0 truncate" : "flex justify-end"}>
                  <Cell column={col} value={row[col.key]} />
                </div>
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
