"use client";

import { useEffect, useState } from "react";

export type EffectTier = 1 | 2 | 3;

const STORAGE_KEY = "nocturne:tier";
// spec samples 10s at boot (§4.7); shortened here so the dev loop doesn't
// spend 10s on every reload — real device tuning should widen this back out.
const SAMPLE_MS = 1500;

function detectReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sampleFpsTier(): Promise<EffectTier> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    function tick() {
      frames++;
      const elapsed = performance.now() - start;
      if (elapsed < SAMPLE_MS) {
        requestAnimationFrame(tick);
        return;
      }
      const fps = (frames / elapsed) * 1000;
      resolve(fps >= 50 ? 3 : fps >= 30 ? 2 : 1);
    }
    requestAnimationFrame(tick);
  });
}

export function getStoredTier(): EffectTier | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "1" || raw === "2" || raw === "3" ? (Number(raw) as EffectTier) : null;
}

export function setStoredTier(tier: EffectTier) {
  window.localStorage.setItem(STORAGE_KEY, String(tier));
}

/**
 * Effect tiers (§4.7): auto-detected by sampling rAF FPS at boot, manually
 * overridable, persisted per screen. `prefers-reduced-motion` is a separate
 * axis — it forces idle/heartbeat off and short color-only transitions
 * regardless of measured tier.
 */
export function useEffectTier(): { tier: EffectTier; reducedMotion: boolean; setTier: (t: EffectTier) => void } {
  // Always start at tier 3 so SSR and the first client paint match — reading
  // localStorage in the initializer would diverge (hydration mismatch on the
  // "tier N" label). Stored/detected tier is applied in useEffect instead.
  const [tier, setTierState] = useState<EffectTier>(3);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from matchMedia, not derived state
    setReducedMotion(detectReducedMotion());

    const stored = getStoredTier();
    if (stored) {
      setTierState(stored);
      return;
    }

    sampleFpsTier().then((detected) => {
      setTierState(detected);
      setStoredTier(detected);
    });
  }, []);

  const setTier = (t: EffectTier) => {
    setStoredTier(t);
    setTierState(t);
  };

  return { tier, reducedMotion, setTier };
}
