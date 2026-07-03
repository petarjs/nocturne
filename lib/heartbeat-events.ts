/** Heartbeat side-channel events (§4.6) — spark replay, dialect flourish triggers. */
export const heartbeatBus = new EventTarget();

export type HeartbeatSparkEvent = { widgetId: string };
export type HeartbeatGlitchEvent = { widgetId: string };

export function dispatchSparkReplay(widgetId: string) {
  heartbeatBus.dispatchEvent(
    new CustomEvent<HeartbeatSparkEvent>("spark-replay", { detail: { widgetId } })
  );
}

export function dispatchScanGlitch(widgetId: string) {
  heartbeatBus.dispatchEvent(
    new CustomEvent<HeartbeatGlitchEvent>("scan-glitch", { detail: { widgetId } })
  );
}
