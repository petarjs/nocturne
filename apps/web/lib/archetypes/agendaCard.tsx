"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Label } from "@/components/primitives/Label";
import { EmptyState } from "@/components/primitives/EmptyState";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string };

function toTimestamp(value: string, base: Date): number {
  const timeOnly = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (timeOnly) {
    const d = new Date(base);
    d.setHours(Number(timeOnly[1]), Number(timeOnly[2]), 0, 0);
    return d.getTime();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function timeLabel(value: string): string {
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Date(parsed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const start = toTimestamp(ev.startsAt, new Date(now));
  let end = toTimestamp(ev.endsAt, new Date(now));
  if (end < start && /^\d{1,2}:\d{2}$/.test(ev.endsAt)) end += 24 * 60 * 60 * 1000;
  if (now >= start && now <= end) return { label: "now", tone: "positive" };
  const mins = Math.round((start - now) / 60_000);
  if (mins > 0 && mins <= 60) return { label: `in ${mins}m`, tone: "accent" };
  return { label: timeLabel(ev.startsAt), tone: "quiet" };
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
    (a, b) => toTimestamp(a.startsAt, new Date(now)) - toTimestamp(b.startsAt, new Date(now))
  );

  if (slot === "ambient") {
    const next = sorted.find((e) => toTimestamp(e.endsAt, new Date(now)) >= now) ?? sorted[0];
    if (!next) {
      return (
        <div className={`n-surface flex h-full w-full items-center gap-3 ${pad}`}>
          {label && <Label>{label}</Label>}
          <EmptyState compact message="Clear" />
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
        {sorted.length === 0 && <EmptyState message="Nothing scheduled" />}
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
                  {timeLabel(ev.startsAt)}
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
