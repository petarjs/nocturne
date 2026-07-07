"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Act, Mood, MotionDialect, ThemeTokens, Widget } from "@nocturne/core";
import type { WidgetSlot } from "@/lib/layout/types";
import { resolveLayout } from "@/lib/layout/resolve";
import { effectiveAct } from "@/lib/layout/alertPromotion";
import { dialects, enterTransition, exitTransition } from "@/lib/dialects";
import { momentBus, type MomentEvent } from "@/lib/moments/bus";
import { MomentFlashProvider } from "@/lib/moment-flash-context";
import { CalmParallax } from "@/components/effects/CalmParallax";
import { ScanGlitch } from "@/components/effects/ScanGlitch";

type Role = WidgetSlot;

function moodOpacity(mood: Mood, role: Role, state: Widget["state"]): number {
  if (state === "critical") return 1;
  if (mood === "alert") return 0.7;
  if (mood === "focus") return role === "hero" ? 1 : role === "supporting" ? 0.8 : 0.5;
  // sleep no longer dims survivors to ghosts — effectiveAct reduces the act to
  // the clock alone, so every other widget exits via AnimatePresence (§1.3 beat 6).
  return 1;
}

function useMomentFlashes() {
  const [flashes, setFlashes] = useState<Record<string, MomentEvent>>({});

  useEffect(() => {
    function onMoment(e: Event) {
      const detail = (e as CustomEvent<MomentEvent>).detail;
      if (detail.tier === "t3") return;
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

export function Stage({
  act,
  widgets,
  anchors = [],
  dialect,
  theme,
  mood,
  lastUpdated,
  morphActive = false,
  morphExitT = 0,
  morphEnterT = 0,
  renderWidget,
}: {
  act: Act;
  widgets: Widget[];
  anchors?: string[];
  dialect: MotionDialect;
  theme: ThemeTokens;
  mood: Mood;
  lastUpdated: Record<string, number>;
  morphActive?: boolean;
  morphExitT?: number;
  morphEnterT?: number;
  renderWidget: (widget: Widget, slot: WidgetSlot) => React.ReactNode;
}) {
  const resolvedAct = effectiveAct(act, mood, widgets, anchors);
  const layout = resolveLayout(resolvedAct, "landscape");
  const flashes = useMomentFlashes();
  const now = useNow(30_000);

  const order = [resolvedAct.hero, ...resolvedAct.supporting, ...resolvedAct.ambient].filter(
    (id): id is string => !!id
  );
  const roleOf = (id: string): Role =>
    id === resolvedAct.hero ? "hero" : resolvedAct.supporting.includes(id) ? "supporting" : "ambient";

  const visible = order
    .map((id) => widgets.find((w) => w.id === id))
    .filter((w): w is Widget => !!w && !!layout[w.id]);

  const visibleIds = visible.map((w) => w.id);

  const prevVisibleRef = useRef<string[] | null>(null);
  const isInitialMount = prevVisibleRef.current === null;

  useEffect(() => {
    prevVisibleRef.current = visibleIds;
  }, [visibleIds]);

  const shape = dialects[dialect];

  const morphExitScale = morphActive ? 1 - morphExitT * 0.04 : 1;
  const morphExitOpacity = morphActive ? 1 - morphExitT * 0.15 : 1;
  const morphEnterLift = morphActive ? morphEnterT * 0.08 : 0;

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
          // §8 / §2.3 rule 4: the one per-widget style override. Remapped onto
          // --n-accent1 for the widget subtree so surface glow and data viz pick
          // it up; falls back to the theme's accent1.
          const widgetAccent =
            widget.accent === "accent2" ? theme.palette.accent2 : theme.palette.accent1;
          const glowColor =
            flash?.accent === "negative" ? theme.palette.negative : widgetAccent;
          const staleMinutes = Math.max(
            1,
            Math.round((now - (lastUpdated[widget.id] ?? now)) / 60_000)
          );

          const role = roleOf(widget.id);
          const isHero = role === "hero";
          const skipEnter = !isInitialMount && (prevVisibleRef.current?.includes(widget.id) ?? false);

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
              initial={skipEnter ? false : shape.enterFrom}
              animate={
                skipEnter
                  ? {
                      opacity: morphExitOpacity,
                      y: morphEnterLift * -12,
                      scale: morphExitScale,
                      clipPath: "none",
                      filter: "none",
                    }
                  : { ...shape.enterTo, opacity: morphExitOpacity, scale: morphExitScale }
              }
              exit={{ ...shape.exitTo, transition: exitTransition }}
              transition={
                skipEnter
                  ? { layout: { type: "spring", stiffness: 260, damping: 28 } }
                  : enterTransition(dialect, i)
              }
            >
              <CalmParallax id={widget.id} role={role} dialect={dialect} className="h-full w-full">
                <motion.div
                  data-widget-id={widget.id}
                  className="relative h-full w-full rounded-[var(--n-radius)]"
                  style={{ ["--n-accent1" as string]: widgetAccent }}
                  animate={{
                    scale: flash || attention ? 1.02 : critical ? 1.02 : 1,
                    opacity: moodOpacity(mood, role, widget.state),
                    filter: stale ? "saturate(0.6)" : "saturate(1)",
                    boxShadow: critical
                      ? `0 0 48px ${theme.palette.negative}55`
                      : flash
                        ? `0 0 32px ${glowColor}55`
                        : "0 0 0 rgba(0,0,0,0)",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: mood === "alert" && !critical ? 80 : 260,
                    damping: mood === "alert" && !critical ? 28 : 22,
                  }}
                >
                  <MomentFlashProvider flash={flash}>
                    {renderWidget(widget, role)}
                  </MomentFlashProvider>
                  <ScanGlitch
                    enabled={dialect === "mechanical" && isHero}
                    widgetId={widget.id}
                  />
                  {stale && (
                    <div className="n-label absolute right-3 top-3 rounded-full border border-white/[0.06] bg-black/25 px-2 py-0.5 text-[11px] opacity-70 backdrop-blur-sm">
                      stale · {staleMinutes}m
                    </div>
                  )}
                </motion.div>
              </CalmParallax>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
