/** Per-widget idle phase offset (§4.2, §7.1) — desyncs ambient motion via id hash. */
export function idlePhase(id: string): number {
  return id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 0.61;
}

/** Idle amplitude caps (§4.2): ≤2px translate, ≤3% opacity, ≤1.01 scale, 4–8s cycles. */
export const IDLE = {
  translatePx: 2,
  opacityDelta: 0.03,
  scaleMax: 1.01,
  cycleMinSec: 4,
  cycleMaxSec: 8,
} as const;

export function idleCycleSec(id: string): number {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const t = (hash % 100) / 100;
  return IDLE.cycleMinSec + t * (IDLE.cycleMaxSec - IDLE.cycleMinSec);
}
