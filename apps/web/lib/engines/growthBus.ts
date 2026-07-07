/**
 * Growth engine side-channel (§5.6): lets the control drawer override the
 * branch's time-of-day so all four lifecycle states (dawn / day / dusk / night)
 * can be demoed without waiting for the wall clock. Decoupled from the scene
 * document — this is a demo affordance, not scene state.
 */
export const growthBus = new EventTarget();

export type GrowthHourEvent = { hour: number | null };

/** hour 0–23 to pin the lifecycle, or null to follow real local time. */
export function setGrowthHour(hour: number | null) {
  growthBus.dispatchEvent(
    new CustomEvent<GrowthHourEvent>("growth-hour", { detail: { hour } })
  );
}
