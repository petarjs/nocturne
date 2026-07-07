import type { Op } from "@nocturne/core";

/**
 * Write-path indirection for remote mode. When a sink is registered (display
 * connected to a dashboard), the store's public applyOp/applyOps hand ops to
 * it — a REST POST — instead of reducing locally; the mutation comes back to
 * every client (including this one) through the WebSocket echo. No sink means
 * local fixture mode: ops reduce in-process exactly as before.
 */
export type OpsSink = (ops: Op[]) => void;

let sink: OpsSink | null = null;

export function setOpsSink(next: OpsSink | null): void {
  sink = next;
}

export function getOpsSink(): OpsSink | null {
  return sink;
}
