"use client";

import { useEffect, useRef } from "react";
import type { Mood } from "@/lib/schema";
import { momentBus } from "@/lib/moments/bus";

const MIN_MS = 2 * 60_000;
const MAX_MS = 5 * 60_000;
const MEAN_MS = 3.5 * 60_000;
const SUPPRESS_AFTER_T2_MS = 60_000;

/** background pulse origin sentinel the Background component special-cases to screen center */
export const HEARTBEAT_CENTER_ID = "__center__";

function poissonDelay(): number {
  const raw = -Math.log(1 - Math.random()) * MEAN_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, raw));
}

/**
 * The heartbeat (§4.6) — alive when nothing happens. Fires one act of
 * spontaneous life every 2-5 minutes (Poisson-spaced): a background pulse
 * from center, or a brief glow on the hero. Never during alert/sleep, and
 * never within 60s of any t2+ (a real event already made the point).
 *
 * Sparkline-replay and the dialect's own signature flourish are two more
 * spec'd actions (§4.6) deferred to when those systems exist.
 */
export function useHeartbeat(mood: Mood, heroId: string | undefined, reducedMotion: boolean) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (reducedMotion) return; // reduced motion turns the heartbeat off entirely

    function schedule() {
      timeoutRef.current = setTimeout(fire, poissonDelay());
    }

    function fire() {
      const suppressed =
        mood === "alert" ||
        mood === "sleep" ||
        performance.now() - momentBus.lastT2At < SUPPRESS_AFTER_T2_MS;

      if (!suppressed) {
        const actions: Array<() => void> = [() => momentBus.trigger(HEARTBEAT_CENTER_ID, "t2")];
        if (heroId) actions.push(() => momentBus.trigger(heroId, "t1"));
        actions[Math.floor(Math.random() * actions.length)]();
      }
      schedule();
    }

    schedule();
    return () => clearTimeout(timeoutRef.current);
  }, [mood, heroId, reducedMotion]);
}
