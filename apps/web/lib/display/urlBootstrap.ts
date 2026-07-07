"use client";

import { useEffect } from "react";
import type { Op } from "@nocturne/core";
import { useSceneStore } from "@/lib/store";

/**
 * Deterministic scene selection from the URL — the plumbing golden frames
 * (§10 criterion 7) and teaser filming both need. Applied once on mount so a
 * capture harness (or a clean filming session) can pin the exact scene, theme,
 * and mood without touching the control drawer:
 *
 *   /display?scene=homelab&theme=kanso&mood=sleep&still=1
 *
 * `still` is read separately by useMotionPrefs (§4.7 reduced-motion path) to
 * quiet idle/heartbeat motion; time itself is frozen test-side via Playwright's
 * clock API, so this file never touches the render loop.
 */
export function useUrlSceneBootstrap() {
  const applyOps = useSceneStore((s) => s.applyOps);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ops: Op[] = [];

    const scene = params.get("scene");
    if (scene) ops.push({ type: "loadScene", name: scene });

    const theme = params.get("theme");
    if (theme) ops.push({ type: "setTheme", theme: { preset: theme } });

    const mood = params.get("mood");
    if (mood === "ambient" || mood === "focus" || mood === "alert" || mood === "sleep") {
      ops.push({ type: "setMood", mood });
    }

    // ?critical=<widgetId> drives a real alert golden: t3 sets the widget
    // critical and the scene to `alert` mood, so promotion + edge vignette are
    // exercised deterministically. Applied last, after any loadScene reset.
    const critical = params.get("critical");
    if (critical) ops.push({ type: "triggerMoment", id: critical, tier: "t3" });

    if (ops.length > 0) applyOps(ops);
    // Intentionally mount-only: golden/filming URLs are set before load, not
    // mutated live. The control drawer owns interactive changes after boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Whether the URL requested still (deterministic) rendering. Client-only. */
export function urlRequestsStill(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("still") === "1";
}
