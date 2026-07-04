"use client";

import { useEffect } from "react";
import { sceneSchema } from "@/lib/schema";
import { useSceneStore } from "@/lib/store";
import { momentBus } from "@/lib/moments/bus";
import { evaluateMoment } from "@/lib/moments/evaluate";

/**
 * Opt-in dev bridge (§9.1): the display route is client-only and drives itself
 * from the Zustand store, so the `POST /api/dev/ops` curl demo has no way to
 * reach the screen on its own. With `?sync=1` this polls the dev route's
 * server-side scene and mirrors changes into the store via a single `setScene`
 * — enough to run the beat runbook (scripts/beats.sh) or film from a phone
 * without the control drawer.
 *
 * Off by default: no fetch loop, no perf cost on a normal wall display. This
 * is deliberately the poor-man's stand-in for the Phase B WebSocket spine and
 * is not wired in production builds' data path.
 */
export function useDevOpsSync() {
  const applyOp = useSceneStore((s) => s.applyOp);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sync") !== "1") return;

    let last = "";
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/dev/ops", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const serialized = JSON.stringify(json);
        if (serialized === last) return; // only push real changes → no anim churn
        const parsed = sceneSchema.safeParse(json);
        if (!parsed.success) return;

        // setScene bypasses the store's runSideEffects, so transient moment
        // choreography (beat 3's ripple) would be lost. Mirror it here: diff
        // each widget's data against the current scene and fire the same
        // evaluation the store would. Only this path mutates in sync mode, so
        // there's no double-fire.
        const prev = useSceneStore.getState().scene;
        if (last) {
          const prevById = new Map(prev.widgets.map((w) => [w.id, w]));
          for (const next of parsed.data.widgets) {
            const before = prevById.get(next.id);
            if (!before || JSON.stringify(before.data) === JSON.stringify(next.data)) continue;
            const tier = evaluateMoment(before, before.data, next.data);
            if (tier !== "t0") momentBus.trigger(next.id, tier);
          }
        }

        last = serialized;
        applyOp({ type: "setScene", scene: parsed.data });
      } catch {
        // dev route unavailable (static export / offline) — silently idle
      }
    };

    void poll();
    const id = window.setInterval(() => {
      if (!stopped) void poll();
    }, 1000);

    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [applyOp]);
}
