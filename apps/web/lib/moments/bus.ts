export type MomentTier = "t0" | "t1" | "t2" | "t3";
export type MomentEvent = { widgetId: string; tier: MomentTier; accent?: "positive" | "negative"; at: number };

const T1_MIN_GAP_MS = 400;
const T2_DURATION_MS = 900;
const T2_COOLDOWN_MS = 5000;
const T2_QUEUE_MAX = 3;
const T2_QUEUE_WINDOW_MS = 5000;

/**
 * The coalescing bus (§4.4) — the anti-seizure system. A dashboard having a
 * bad day must look urgent, never epileptic: at most one t1 per 400ms, one
 * active t2 globally (others within 5s merge into a max-3 queue, oldest
 * dropped), a 5s global cooldown after any t2, and t3 is exclusive — while
 * active, lower tiers are suppressed.
 */
class MomentBus extends EventTarget {
  private lastT1 = 0;
  private t2Active = false;
  private t2CooldownUntil = 0;
  private t2Queue: MomentEvent[] = [];
  private t3Active = false;
  lastT2At = 0;

  trigger(widgetId: string, tier: MomentTier, opts: { accent?: "positive" | "negative" } = {}) {
    const now = performance.now();

    if (tier === "t3") {
      this.t3Active = true;
      this.emit({ widgetId, tier, at: now, ...opts });
      return;
    }

    if (this.t3Active) {
      // suppressed and counted as a badge on the widget (future work)
      return;
    }

    if (tier === "t1") {
      if (now - this.lastT1 < T1_MIN_GAP_MS) return;
      this.lastT1 = now;
      this.emit({ widgetId, tier, at: now, ...opts });
      return;
    }

    if (tier === "t2") {
      const event: MomentEvent = { widgetId, tier, at: now, ...opts };
      if (this.t2Active || now < this.t2CooldownUntil) {
        this.t2Queue = this.t2Queue.filter((e) => now - e.at < T2_QUEUE_WINDOW_MS);
        if (this.t2Queue.length >= T2_QUEUE_MAX) this.t2Queue.shift();
        this.t2Queue.push(event);
        return;
      }
      this.fireT2(event);
      return;
    }

    // t0: silent, value morphs only — nothing to choreograph on the bus
  }

  clearAlert() {
    this.t3Active = false;
  }

  private fireT2(event: MomentEvent) {
    this.t2Active = true;
    this.lastT2At = event.at;
    this.emit(event);
    setTimeout(() => {
      this.t2Active = false;
      this.t2CooldownUntil = performance.now() + T2_COOLDOWN_MS;
      const next = this.t2Queue.shift();
      if (next) this.fireT2({ ...next, at: performance.now() });
    }, T2_DURATION_MS);
  }

  private emit(event: MomentEvent) {
    this.dispatchEvent(new CustomEvent<MomentEvent>("moment", { detail: event }));
  }
}

export const momentBus = new MomentBus();
