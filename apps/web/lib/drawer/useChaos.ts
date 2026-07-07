"use client";

import { useEffect } from "react";
import type { Widget } from "@nocturne/core";
import type { Op } from "@nocturne/core";
import { chaosTick, randomWalkTick } from "@/lib/chaos";
import { isMetricWidget } from "@/lib/moments/evaluate";

const CHAOS_INTERVAL_MS = 900;

/** Chaos mode + per-widget random-walk toggles (§10). */
export function useChaosEngine(
  chaos: boolean,
  walkIds: string[],
  widgets: Widget[],
  applyOp: (op: Op) => void
) {
  useEffect(() => {
    if (!chaos && walkIds.length === 0) return;

    const walkSet = new Set(walkIds);
    const id = setInterval(() => {
      for (const widget of widgets) {
        if (!isMetricWidget(widget.type)) continue;
        const active = chaos || walkSet.has(widget.id);
        if (!active) continue;
        const patch = chaos ? chaosTick(widget) : randomWalkTick(widget);
        if (patch) applyOp({ type: "pushData", id: widget.id, data: patch });
      }
    }, CHAOS_INTERVAL_MS);

    return () => clearInterval(id);
  }, [chaos, walkIds, widgets, applyOp]);
}
