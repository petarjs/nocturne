"use client";

import { useEffect } from "react";
import type { Scene } from "@nocturne/core";
import { useSceneStore } from "@/lib/store";

const DEFAULT_TTL_SEC = 60;
const CHECK_INTERVAL_MS = 5000;

/**
 * Staleness (§4.5): every data binding has a freshness TTL (default 60s).
 * At 2×TTL the widget desaturates and shows a quiet chip — no per-widget
 * "last updated" timestamps otherwise. This just flips `state` between
 * `normal` and `stale`; Stage owns the actual visual treatment.
 */
export function useStalenessWatcher(scene: Scene, lastUpdated: Record<string, number>) {
  // Deliberately ingestOps, not applyOp: staleness is per-client presentation
  // state derived from local receive times. In remote mode it must not POST
  // to the server (a pure viewer has no API key), just flip state locally.
  const ingestOps = useSceneStore((s) => s.ingestOps);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      for (const widget of scene.widgets) {
        if (widget.type === "clock") continue; // self-updates from local time, never receives pushData

        const ttlSec = widget.bind?.ttlSec ?? DEFAULT_TTL_SEC;
        const threshold = ttlSec * 2 * 1000;
        const since = now - (lastUpdated[widget.id] ?? now);
        const shouldBeStale = since >= threshold;

        if (shouldBeStale && widget.state === "normal") {
          ingestOps([{ type: "updateWidget", id: widget.id, patch: { state: "stale" } }]);
        } else if (!shouldBeStale && widget.state === "stale") {
          ingestOps([{ type: "updateWidget", id: widget.id, patch: { state: "normal" } }]);
        }
      }
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [scene.widgets, lastUpdated, ingestOps]);
}
