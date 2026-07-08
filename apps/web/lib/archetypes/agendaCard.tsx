"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Label } from "@/components/primitives/Label";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string };

function toTimestampToday(hhmm: string, base: Date): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type Status = { label: string; tone: "positive" | "accent" | "quiet" };

function statusFor(ev: EventItem, now: number): Status {
  const start = toTimestampToday(ev.startsAt, new Date(now));
  const end = toTimestampToday(ev.endsAt, new Date(now));
  if (now >= start && now <= end) return { label: "now", tone: "positive" };
  const mins = Math.round((start - now) / 60_000);
  if (mins > 0 && mins <= 60) return { label: `in ${mins}m`, tone: "accent" };
  return { label: ev.startsAt, tone: "quiet" };
}

function statusColor(tone: Status["tone"]): string {
  return tone === "positive" ? "var(--n-positive)" : tone === "accent" ? "var(--n-accent1)" : "var(--n-text2)";
}

/** agenda preset (§7.3): rows archetype — events with a live "in 25 min" countdown. */
export function AgendaCard({
  slot,
  label,
  events,
}: {
  slot: ArchetypeSlot;
  label?: string;
  events: EventItem[];
}) {
  const pad = surfacePadForSlot[slot];
  const now = useMinuteClock();
  const sorted = [...events].sort(
    (a, b) => toTimestampToday(a.startsAt, new Date(now)) - toTimestampToday(b.startsAt, new Date(now))
  );

  if (slot === "ambient") {
    const next = sorted.find((e) => toTimestampToday(e.endsAt, new Date(now)) >= now) ?? sorted[0];
    if (!next) {
      return (
        <div className={`n-surface flex h-full w-full items-center ${pad}`}>
          {label && <Label>{label}</Label>}
        </div>
      );
    }
    const status = statusFor(next, now);
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        {label && <Label className="w-16 shrink-0 leading-tight">{label}</Label>}
        <span className="n-data min-w-0 flex-1 truncate text-[length:var(--n-meta-size)]">{next.title}</span>
        <span
          className="n-data shrink-0 text-[length:calc(var(--n-meta-size)*0.9)] uppercase tracking-wider tabular-nums"
          style={{ color: statusColor(status.tone) }}
        >
          {status.label}
        </span>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-3 overflow-hidden ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      {label && <Label>{label}</Label>}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {sorted.map((ev, i) => {
            const status = statusFor(ev, now);
            const isNow = status.tone === "positive";
            return (
              <motion.div
                key={ev.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 200, damping: 24, delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-[calc(var(--n-radius)-4px)] px-2 py-1.5 ${isNow ? "bg-[var(--n-accent1)]/8" : ""}`}
              >
                <span
                  className="n-data w-12 shrink-0 tabular-nums text-[length:calc(var(--n-meta-size)*0.9)]"
                  style={{ color: "var(--n-text2)" }}
                >
                  {ev.startsAt}
                </span>
                <span
                  className="n-data min-w-0 flex-1 truncate"
                  style={{ fontSize: "16px", color: "var(--n-text1)" }}
                >
                  {ev.title}
                </span>
                <span
                  className="n-data shrink-0 text-[length:calc(var(--n-meta-size)*0.9)] uppercase tracking-wider tabular-nums"
                  style={{ color: statusColor(status.tone) }}
                >
                  {status.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
