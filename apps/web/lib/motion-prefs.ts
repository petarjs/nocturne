"use client";

import { useEffect, useState } from "react";
import { type EffectTier, getStoredTier, setStoredTier, useEffectTier } from "./tiers";
import { urlRequestsStill } from "./display/urlBootstrap";

const SIM_KEY = "nocturne:simulate-reduced-motion";

function detectReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getSimulatedReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIM_KEY) === "1";
}

function setSimulatedReduced(on: boolean) {
  window.localStorage.setItem(SIM_KEY, on ? "1" : "0");
}

/**
 * Perf overlay controls (§10): tier override + reduced-motion simulation.
 * OS `prefers-reduced-motion` and the sim flag are OR'd — either forces
 * reduced behavior (§4.7).
 */
export function useMotionPrefs() {
  const { tier, setTier } = useEffectTier();
  const [osReduced, setOsReduced] = useState(false);
  const [simulateReduced, setSimulateReducedState] = useState(false);
  const [stillMode, setStillMode] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from matchMedia
    setOsReduced(detectReducedMotion());
    setSimulateReducedState(getSimulatedReduced());
    setStillMode(urlRequestsStill());

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setOsReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setSimulateReduced = (on: boolean) => {
    setSimulatedReduced(on);
    setSimulateReducedState(on);
  };

  return {
    tier,
    setTier,
    reducedMotion: osReduced || simulateReduced || stillMode,
    simulateReduced,
    setSimulateReduced,
    getStoredTier,
    setStoredTier,
  };
}

export type MotionPrefs = ReturnType<typeof useMotionPrefs>;
export type { EffectTier };
