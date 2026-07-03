"use client";

import { useEffect, useRef, useState } from "react";
import type { Act, Mood, Widget } from "@/lib/schema";
import type { Narrative } from "@/lib/schema";
import { actHasWidget } from "@/lib/layout/actUtils";
import { momentBus, type MomentEvent } from "@/lib/moments/bus";

type Rotation = Narrative["rotation"];

/**
 * Act rotation runtime (§6.3): dwell timer, alert pin, off-screen t2 indicator pulse.
 * Suppressed during alert/sleep moods and reduced motion (§4.5, §4.7).
 */
export function useActRotation({
  acts,
  rotation,
  mood,
  widgets,
  reducedMotion,
}: {
  acts: Act[];
  rotation: Rotation;
  mood: Mood;
  widgets: Widget[];
  reducedMotion: boolean;
}) {
  const [actIndex, setActIndex] = useState(0);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [indicatorPulse, setIndicatorPulse] = useState(false);
  const dwellStartRef = useRef(performance.now());
  const actIndexRef = useRef(0);

  const enabled = rotation.mode !== "off" && acts.length > 1;
  const suppressed = mood === "alert" || mood === "sleep" || reducedMotion;

  const criticalWidget = widgets.find((w) => w.state === "critical");
  const pinnedIndex = criticalWidget
    ? acts.findIndex((a) => actHasWidget(a, criticalWidget.id))
    : -1;

  const effectiveIndex =
    pinnedIndex >= 0 ? pinnedIndex : ((actIndex % acts.length) + acts.length) % acts.length;
  const currentAct = acts[effectiveIndex] ?? acts[0];

  actIndexRef.current = effectiveIndex;

  const dwellSec = currentAct?.dwellSec ?? rotation.dwellSec;
  const dwellMs = dwellSec * 1000;

  useEffect(() => {
    setActIndex(0);
    dwellStartRef.current = performance.now();
    setDwellProgress(0);
  }, [acts.length, rotation.mode]);

  useEffect(() => {
    if (!enabled || suppressed) {
      setDwellProgress(0);
      return;
    }

    dwellStartRef.current = performance.now();
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - dwellStartRef.current;
      const progress = Math.min(1, elapsed / dwellMs);
      setDwellProgress(progress);

      if (progress >= 1 && pinnedIndex < 0) {
        setActIndex((i) => i + 1);
        dwellStartRef.current = performance.now();
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, suppressed, dwellMs, pinnedIndex, effectiveIndex]);

  useEffect(() => {
    if (!enabled || rotation.indicator === "none") return;

    function onMoment(e: Event) {
      const detail = (e as CustomEvent<MomentEvent>).detail;
      if (detail.tier !== "t2") return;
      const act = acts[actIndexRef.current];
      if (!act || actHasWidget(act, detail.widgetId)) return;
      setIndicatorPulse(true);
      window.setTimeout(() => setIndicatorPulse(false), 900);
    }

    momentBus.addEventListener("moment", onMoment);
    return () => momentBus.removeEventListener("moment", onMoment);
  }, [enabled, rotation.indicator, acts]);

  return {
    currentAct,
    actIndex: effectiveIndex,
    actCount: acts.length,
    dwellProgress,
    indicatorVisible: enabled && rotation.indicator === "hairline" && !suppressed,
    indicatorPulse,
    rotationEnabled: enabled && !suppressed,
  };
}
