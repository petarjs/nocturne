"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Act, Mood, MotionDialect, ThemeTokens, Widget } from "@/lib/schema";
import { resolveLayout } from "@/lib/layout/resolve";
import { dialects, enterTransition, exitTransition } from "@/lib/dialects";
import { momentBus, type MomentEvent } from "@/lib/moments/bus";

type Role = "hero" | "supporting" | "ambient";

// widget opacity by mood + role (§4.5 focus, and the t3 "everything else
// dims to 70%" rule folded in for alert since it's the same mechanism)
function moodOpacity(mood: Mood, role: Role, state: Widget["state"]): number {
  if (state === "critical") return 1;
  if (mood === "alert") return 0.7;
  if (mood === "focus") return role === "hero" ? 1 : role === "supporting" ? 0.8 : 0.5;
  if (mood === "sleep") return role === "hero" ? 1 : 0.3;
  return 1;
}

// transient flash from the moments bus (§4.4 t1/t2) — separate from the
// widget's persistent `state` (attention/critical), which the reducer owns
function useMomentFlashes() {
  const [flashes, setFlashes] = useState<Record<string, MomentEvent>>({});

  useEffect(() => {
    function onMoment(e: Event) {
      const detail = (e as CustomEvent<MomentEvent>).detail;
      if (detail.tier === "t3") return; // t3 is sustained widget.state, not a flash
      setFlashes((f) => ({ ...f, [detail.widgetId]: detail }));
      const duration = detail.tier === "t1" ? 400 : 900;
      setTimeout(() => {
        setFlashes((f) => {
          if (f[detail.widgetId]?.at !== detail.at) return f;
          const next = { ...f };
          delete next[detail.widgetId];
          return next;
        });
      }, duration);
    }
    momentBus.addEventListener("moment", onMoment);
    return () => momentBus.removeEventListener("moment", onMoment);
  }, []);

  return flashes;
}

// a ticking clock for the "stale · Nm" chip — reading Date.now() directly in
// render would be an impure render (and a hydration hazard); this samples it
// on an interval instead, same pattern as the Clock widget.
function useNow(intervalMs: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to a timer, not derived state
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// The stage: turns narrative roles into geometry (§6) and choreographs
// every widget's enter/exit/travel through FLIP (§6.5). A widget present
// before and after any change travels, resizes, and re-themes in place —
// it never exits and re-enters (§2.1, §6.5). motion's `layout` prop is
// the FLIP engine; this component just feeds it grid cells and variants.
export function Stage({
  act,
  widgets,
  dialect,
  theme,
  mood,
  lastUpdated,
  renderWidget,
}: {
  act: Act;
  widgets: Widget[];
  dialect: MotionDialect;
  theme: ThemeTokens;
  mood: Mood;
  lastUpdated: Record<string, number>;
  renderWidget: (widget: Widget) => React.ReactNode;
}) {
  const layout = resolveLayout(act, "landscape");
  const flashes = useMomentFlashes();
  const now = useNow(30_000);

  // packing order (§6.2): role, then insertion order — this is also the
  // stagger order for enter (§4.1: 60ms × primitive/widget order)
  const order = [act.hero, ...act.supporting, ...act.ambient].filter(
    (id): id is string => !!id
  );
  const roleOf = (id: string): Role =>
    id === act.hero ? "hero" : act.supporting.includes(id) ? "supporting" : "ambient";

  const visible = order
    .map((id) => widgets.find((w) => w.id === id))
    .filter((w): w is Widget => !!w && !!layout[w.id]);

  const shape = dialects[dialect];

  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: "repeat(12, 1fr)",
        gridTemplateRows: "repeat(6, 1fr)",
        gap: 16,
      }}
    >
      <AnimatePresence>
        {visible.map((widget, i) => {
          const cell = layout[widget.id];
          const flash = flashes[widget.id];
          const critical = widget.state === "critical";
          const attention = widget.state === "attention";
          const stale = widget.state === "stale";
          const glowColor = flash?.accent === "negative" ? theme.palette.negative : theme.palette.accent1;
          const staleMinutes = Math.max(1, Math.round((now - (lastUpdated[widget.id] ?? now)) / 60_000));

          return (
            <motion.div
              key={widget.id}
              layout
              layoutId={widget.id}
              className="min-h-0 min-w-0"
              style={{
                gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
              }}
              initial={shape.enterFrom}
              animate={{ ...shape.enterTo, transition: enterTransition(dialect, i) }}
              exit={{ ...shape.exitTo, transition: exitTransition }}
            >
              <motion.div
                data-widget-id={widget.id}
                className="relative h-full w-full rounded-[var(--n-radius)]"
                animate={{
                  scale: flash || attention ? 1.02 : critical ? 1.02 : 1,
                  opacity: moodOpacity(mood, roleOf(widget.id), widget.state),
                  filter: stale ? "saturate(0.6)" : "saturate(1)",
                  boxShadow: critical
                    ? `0 0 48px ${theme.palette.negative}55`
                    : flash
                      ? `0 0 32px ${glowColor}55`
                      : "0 0 0 rgba(0,0,0,0)",
                }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                {renderWidget(widget)}
                {stale && (
                  <div className="n-label absolute right-4 top-4 rounded-full bg-black/30 px-2 py-0.5">
                    stale · {staleMinutes}m
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
