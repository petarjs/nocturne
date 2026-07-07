"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { opsBatchSchema, sceneSchema, type Op } from "@nocturne/core";
import {
  WS_CLOSE_NOT_FOUND,
  WS_CLOSE_PURGED,
  WS_CLOSE_VIEW_CODE,
  WS_PING,
  WS_PONG,
  type ServerMsg,
} from "@nocturne/core/protocol";
import { useSceneStore } from "@/lib/store";
import { setOpsSink } from "./sink";
import { getViewCode, getWsUrl, setViewCode } from "./config";
import { api } from "./client";

const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;
const WRITE_ERROR_LINGER_MS = 4_000;

export type RemoteSync = {
  /** false = local fixture mode; the display behaves exactly as before. */
  active: boolean;
  connected: boolean;
  /** The dashboard is view-code locked and this browser doesn't have it (yet). */
  needsCode: boolean;
  /** The dashboard was deleted or never existed — reconnecting won't help. */
  gone: boolean;
  /** A drawer write recently failed (bad/missing API key, server down). */
  writeFailed: boolean;
  submitCode: (code: string) => void;
};

/**
 * Remote mode for the display (§9.2 spine, client half). Connects to the
 * dashboard's live socket; the initial `sync` lands as a setScene through the
 * store's local-ingest path (fresh timestamps + alert bootstrap included) and
 * `ops` frames run the same reducer + side effects as local mutations, so
 * moment choreography fires identically on every connected browser. While
 * active, the store's write path POSTs ops to the server; the mutation
 * renders via the WS echo (server-authoritative, no optimistic apply).
 */
export function useRemoteSync(slug: string | null): RemoteSync {
  const [connected, setConnected] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [gone, setGone] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  // Bumped when the user enters a view code so the connection effect re-runs.
  const [codeAttempt, setCodeAttempt] = useState(0);
  const writeErrorTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    let disposed = false;
    let ws: WebSocket | null = null;
    let localRev = -1;
    let attempt = 0;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let pongDeadline: number | null = null;

    const ingest = (ops: Op[]) => useSceneStore.getState().ingestOps(ops);

    setGone(false);
    setOpsSink((ops) => {
      api.postOps(slug, ops).catch(() => {
        if (disposed) return;
        setWriteFailed(true);
        if (writeErrorTimer.current !== null) window.clearTimeout(writeErrorTimer.current);
        writeErrorTimer.current = window.setTimeout(
          () => setWriteFailed(false),
          WRITE_ERROR_LINGER_MS
        );
      });
    });

    const stopPing = () => {
      if (pingTimer !== null) window.clearInterval(pingTimer);
      pingTimer = null;
      pongDeadline = null;
    };

    const startPing = () => {
      stopPing();
      pingTimer = window.setInterval(() => {
        if (pongDeadline !== null && Date.now() > pongDeadline) {
          // Dead link (sleep/tunnel drop): force the close path → reconnect.
          ws?.close();
          return;
        }
        pongDeadline = Date.now() + PONG_TIMEOUT_MS;
        try {
          ws?.send(WS_PING);
        } catch {
          // closing anyway
        }
      }, PING_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      attempt += 1;
      const backoff = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
      const jitter = 0.8 + Math.random() * 0.4;
      reconnectTimer = window.setTimeout(connect, backoff * jitter);
    };

    const handleMessage = (raw: unknown) => {
      if (typeof raw !== "string") return;
      if (raw === WS_PONG) {
        pongDeadline = null;
        return;
      }
      let msg: ServerMsg;
      try {
        msg = JSON.parse(raw) as ServerMsg;
      } catch {
        return;
      }
      if (msg.type === "sync") {
        const scene = sceneSchema.safeParse(msg.scene);
        if (!scene.success) return;
        ingest([{ type: "setScene", scene: scene.data }]);
        localRev = msg.rev;
        return;
      }
      if (msg.type === "ops") {
        if (msg.from !== localRev) {
          ws?.send(JSON.stringify({ type: "resync" }));
          return;
        }
        const ops = opsBatchSchema.safeParse(msg.ops);
        if (!ops.success) return;
        ingest(ops.data);
        localRev = msg.to;
      }
    };

    const connect = () => {
      if (disposed) return;
      const code = getViewCode(slug);
      const qs = code ? `?code=${encodeURIComponent(code)}` : "";
      ws = new WebSocket(`${getWsUrl()}/v1/dashboards/${encodeURIComponent(slug)}/live${qs}`);

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        setNeedsCode(false);
        startPing();
      };
      ws.onmessage = (event) => handleMessage(event.data);
      ws.onclose = (event) => {
        setConnected(false);
        stopPing();
        if (disposed) return;
        if (event.code === WS_CLOSE_VIEW_CODE) {
          setNeedsCode(true); // wait for the gate; submitCode re-runs the effect
          return;
        }
        if (event.code === WS_CLOSE_PURGED || event.code === WS_CLOSE_NOT_FOUND) {
          setGone(true);
          return;
        }
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      setOpsSink(null);
      stopPing();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
      setConnected(false);
    };
  }, [slug, codeAttempt]);

  const submitCode = useCallback(
    (code: string) => {
      if (!slug) return;
      setViewCode(slug, code);
      setNeedsCode(false);
      setCodeAttempt((n) => n + 1);
    },
    [slug]
  );

  return { active: slug !== null, connected, needsCode, gone, writeFailed, submitCode };
}
