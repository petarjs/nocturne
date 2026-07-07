"use client";

import { useEffect, useRef, useState } from "react";
import type { Mood, MotionDialect } from "@nocturne/core";
import { momentBus } from "@/lib/moments/bus";
import {
  dispatchScanGlitch,
  dispatchSparkReplay,
  heartbeatBus,
} from "@/lib/heartbeat-events";

const MIN_MS = 2 * 60_000;
const MAX_MS = 5 * 60_000;
const MEAN_MS = 3.5 * 60_000;
const SUPPRESS_AFTER_T2_MS = 60_000;

export const HEARTBEAT_CENTER_ID = "__center__";

function poissonDelay(): number {
  const raw = -Math.log(1 - Math.random()) * MEAN_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, raw));
}

function pickSparkWidget(): string | null {
  const els = document.querySelectorAll("[data-has-spark='true']");
  if (els.length === 0) return null;
  const el = els[Math.floor(Math.random() * els.length)] as HTMLElement;
  return el.dataset.widgetId ?? null;
}

/**
 * The heartbeat (§4.6) — one spontaneous act every 2–5 minutes: background
 * pulse, hero glow swell, sparkline replay, or dialect signature flourish.
 */
export function useHeartbeat(
  mood: Mood,
  heroId: string | undefined,
  dialect: MotionDialect,
  bgEngine: string,
  reducedMotion: boolean
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (reducedMotion) return;

    function schedule() {
      timeoutRef.current = setTimeout(fire, poissonDelay());
    }

    function fire() {
      const suppressed =
        mood === "alert" ||
        mood === "sleep" ||
        performance.now() - momentBus.lastT2At < SUPPRESS_AFTER_T2_MS;

      if (!suppressed) {
        const actions: Array<() => void> = [
          () => momentBus.trigger(HEARTBEAT_CENTER_ID, "t2"),
        ];
        if (heroId) actions.push(() => momentBus.trigger(heroId, "t1"));

        const sparkId = pickSparkWidget();
        if (sparkId) {
          actions.push(() => dispatchSparkReplay(sparkId));
        }

        if (dialect === "ink" && bgEngine === "growth") {
          actions.push(() => momentBus.trigger(HEARTBEAT_CENTER_ID, "t2"));
        }

        if (dialect === "mechanical" && heroId) {
          actions.push(() => dispatchScanGlitch(heroId));
        }

        actions[Math.floor(Math.random() * actions.length)]();
      }
      schedule();
    }

    schedule();
    return () => clearTimeout(timeoutRef.current);
  }, [mood, heroId, dialect, bgEngine, reducedMotion]);
}
