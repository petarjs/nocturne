import { z } from "zod";
import type { Op, Scene } from "./schema";

/**
 * Live WebSocket protocol between a SceneDO and display clients.
 *
 * The server owns `rev`. Clients apply an `ops` frame iff their local rev
 * equals `from` (then set it to `to`); any mismatch means frames were missed
 * and the client asks for a full re-sync — deliberately the only recovery
 * path (PRD §9.2), keeping the protocol at two effective message types.
 * The socket is read-only for clients: writes go over REST with an API key.
 */
export type ServerMsg =
  | { type: "sync"; rev: number; scene: Scene }
  | { type: "ops"; from: number; to: number; ops: Op[] }
  | { type: "error"; code: string; message: string };

export type ClientMsg = { type: "resync" };

export const clientMsgSchema = z.object({ type: z.literal("resync") });

/** App-level liveness: clients send the literal string "ping"; the DO's
 * auto-responder answers "pong" without waking it. Not JSON on purpose. */
export const WS_PING = "ping";
export const WS_PONG = "pong";

/** Close codes the client distinguishes. */
export const WS_CLOSE_PURGED = 4000; // dashboard deleted — stop reconnecting
export const WS_CLOSE_VIEW_CODE = 4001; // view code required/changed — re-gate
export const WS_CLOSE_NOT_FOUND = 4004; // no such dashboard
