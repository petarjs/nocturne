import { DurableObject } from "cloudflare:workers";
import { mergeWidgetData, reduce, type Op, type Scene } from "@nocturne/core";
import { scenePresets } from "@nocturne/core/fixtures";
import {
  clientMsgSchema,
  WS_CLOSE_NOT_FOUND,
  WS_CLOSE_PURGED,
  WS_CLOSE_VIEW_CODE,
  WS_PING,
  WS_PONG,
  type ServerMsg,
} from "@nocturne/core/protocol";

export type SceneMeta = { slug: string; name: string; viewCode: string | null; createdAt: number };
export type SceneSnapshot = { rev: number; scene: Scene; name: string; viewCodeRequired: boolean };
// Flat shapes (no divergent-key unions): RPC stub typing flattens discriminated
// unions across the wire, so results carry a status code plus nullable payload.
export type SceneAccess = {
  code: "ok" | "not_found" | "view_code_required" | "forbidden";
  snapshot: SceneSnapshot | null;
};

/**
 * One DO per dashboard (`idFromName(slug)`), the single writer for its scene.
 * Runs the same pure reducer as the browser store; `rev` is the protocol
 * counter (deliberately not `scene.version`, which is a document field).
 *
 * Moment choreography stays client-side on purpose: every client derives
 * t1–t3 from the identical op stream, so the stored scene is "raw" reducer
 * output and self-heals on sync via the store's bootstrapSceneAlerts.
 */
export class SceneDO extends DurableObject<Env> {
  private scene: Scene | null = null;
  private rev = 0;
  private meta: SceneMeta | null = null;
  private saved: Record<string, Scene> = {};

  // pushData coalescing (≤4 broadcast frames/sec): latest patch per widget,
  // plus the rev span the buffer covers. A pending timer keeps the DO awake,
  // which is exactly as long as data is flowing.
  private pushBuffer = new Map<string, unknown>();
  private pushBufferFrom: number | null = null;
  private pushBufferTo = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS oplog (
         rev INTEGER PRIMARY KEY,
         ops TEXT NOT NULL,
         at INTEGER NOT NULL
       )`
    );
    // Keepalive answered by the runtime without waking a hibernated DO.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
    // The constructor re-runs on every wake (including after hibernation);
    // this is the rehydration path for in-memory state.
    this.ctx.blockConcurrencyWhile(async () => {
      this.meta = (await this.ctx.storage.get<SceneMeta>("meta")) ?? null;
      this.scene = (await this.ctx.storage.get<Scene>("scene")) ?? null;
      this.rev = (await this.ctx.storage.get<number>("rev")) ?? 0;
      for (const [key, value] of await this.ctx.storage.list<Scene>({ prefix: "saved:" })) {
        this.saved[key.slice("saved:".length)] = value;
      }
    });
  }

  // ── live WebSockets (Hibernation API) ─────────────────────────────────────

  /** The `/live` upgrade, forwarded verbatim by the worker (`?code=` included). */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Rejections happen post-accept with an app close code — a browser
    // WebSocket can't read HTTP error statuses, but it can read close codes.
    const rejectWith = (code: number, reason: string) => {
      server.accept();
      server.close(code, reason);
      return new Response(null, { status: 101, webSocket: client });
    };

    if (!this.meta || !this.scene) return rejectWith(WS_CLOSE_NOT_FOUND, "no such dashboard");
    if (this.meta.viewCode !== null) {
      const code = new URL(request.url).searchParams.get("code");
      if (code !== this.meta.viewCode) {
        return rejectWith(WS_CLOSE_VIEW_CODE, "view code required");
      }
    }

    this.ctx.acceptWebSocket(server);
    this.sendTo(server, { type: "sync", rev: this.rev, scene: this.scene });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    if (typeof message !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    // The socket is read-only: `resync` is the only client message.
    if (clientMsgSchema.safeParse(parsed).success && this.scene) {
      this.sendTo(ws, { type: "sync", rev: this.rev, scene: this.scene });
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket already gone — close events do the cleanup
    }
  }

  private broadcast(msg: ServerMsg): void {
    const serialized = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(serialized);
      } catch {
        // skip dead sockets
      }
    }
  }

  private closeAll(code: number, reason: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(code, reason);
      } catch {
        // already closed
      }
    }
  }

  /**
   * `from` is the rev before this batch applied. All-pushData batches are
   * merged into the buffer and flushed on a 250 ms cadence; anything with a
   * control op flushes pending data first (ordering) and broadcasts at once.
   */
  private queueBroadcast(ops: Op[], from: number): void {
    if (ops.every((op) => op.type === "pushData")) {
      this.pushBufferFrom ??= from;
      this.pushBufferTo = this.rev;
      for (const op of ops) {
        if (op.type !== "pushData") continue;
        // Shallow merge matches mergeWidgetData, which is associative — one
        // coalesced pushData per widget ≡ applying every patch in order.
        this.pushBuffer.set(op.id, mergeWidgetData(this.pushBuffer.get(op.id), op.data));
      }
      this.flushTimer ??= setTimeout(() => this.flushPushBuffer(), 250);
      return;
    }
    this.flushPushBuffer();
    this.broadcast({ type: "ops", from, to: this.rev, ops });
  }

  private flushPushBuffer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pushBufferFrom === null) return;
    const ops: Op[] = [...this.pushBuffer].map(([id, data]) => ({ type: "pushData", id, data }));
    const frame: ServerMsg = { type: "ops", from: this.pushBufferFrom, to: this.pushBufferTo, ops };
    this.pushBuffer.clear();
    this.pushBufferFrom = null;
    this.broadcast(frame);
  }

  // ── lifecycle + state ─────────────────────────────────────────────────────

  /** Idempotent: an already-initialized dashboard is adopted, never overwritten. */
  async init(input: { slug: string; name: string; scene: Scene | null }): Promise<{ existed: boolean }> {
    if (this.meta && this.scene) return { existed: true };
    this.meta = { slug: input.slug, name: input.name, viewCode: null, createdAt: Date.now() };
    this.scene = input.scene ?? scenePresets.minimal;
    this.rev = 0;
    await this.ctx.storage.put("meta", this.meta);
    await this.ctx.storage.put("scene", this.scene);
    await this.ctx.storage.put("rev", this.rev);
    return { existed: false };
  }

  getSceneFor(code: string | null): SceneAccess {
    if (!this.meta || !this.scene) return { code: "not_found", snapshot: null };
    if (this.meta.viewCode !== null) {
      if (code === null) return { code: "view_code_required", snapshot: null };
      if (code !== this.meta.viewCode) return { code: "forbidden", snapshot: null };
    }
    return {
      code: "ok",
      snapshot: {
        rev: this.rev,
        scene: this.scene,
        name: this.meta.name,
        viewCodeRequired: this.meta.viewCode !== null,
      },
    };
  }

  /** `rev: null` means the dashboard doesn't exist. */
  async applyOps(ops: Op[]): Promise<{ rev: number | null }> {
    if (!this.meta || !this.scene) return { rev: null };
    const from = this.rev;

    // Fold op-by-op (not reduceBatch) so a mid-batch saveScene snapshots the
    // scene as it was at that point, and a later loadScene can see it.
    const scenesByName: Record<string, Scene> = { ...scenePresets, ...this.saved };
    let scene = this.scene;
    for (const op of ops) {
      scene = reduce(scene, op, { scenesByName });
      if (op.type === "saveScene") {
        scenesByName[op.name] = scene;
        this.saved[op.name] = scene;
        await this.ctx.storage.put(`saved:${op.name}`, scene);
      }
    }

    this.scene = scene;
    this.rev += 1;
    await this.ctx.storage.put("scene", this.scene);
    await this.ctx.storage.put("rev", this.rev);
    this.ctx.storage.sql.exec(
      `INSERT INTO oplog (rev, ops, at) VALUES (?, ?, ?)`,
      this.rev,
      JSON.stringify(ops),
      Date.now()
    );
    // Audit/debug ring only — reconnect recovery is a full re-sync (§9.2).
    this.ctx.storage.sql.exec(
      `DELETE FROM oplog WHERE rev <= (SELECT MAX(rev) FROM oplog) - 200`
    );

    this.queueBroadcast(ops, from);
    return { rev: this.rev };
  }

  async patchSettings(patch: {
    name?: string;
    viewCode?: string | null;
  }): Promise<{ name: string; viewCodeRequired: boolean } | null> {
    if (!this.meta) return null;
    if (patch.name !== undefined) this.meta.name = patch.name;
    if (patch.viewCode !== undefined) {
      const changed = this.meta.viewCode !== patch.viewCode;
      this.meta.viewCode = patch.viewCode;
      // Setting or changing a code kicks live viewers back through the gate;
      // clearing one doesn't need to kick anyone.
      if (changed && patch.viewCode !== null) {
        this.closeAll(WS_CLOSE_VIEW_CODE, "view code changed");
      }
    }
    await this.ctx.storage.put("meta", this.meta);
    return { name: this.meta.name, viewCodeRequired: this.meta.viewCode !== null };
  }

  async purge(): Promise<void> {
    this.closeAll(WS_CLOSE_PURGED, "dashboard deleted");
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pushBuffer.clear();
    this.pushBufferFrom = null;
    this.ctx.storage.sql.exec(`DELETE FROM oplog`);
    await this.ctx.storage.deleteAll();
    this.scene = null;
    this.meta = null;
    this.rev = 0;
    this.saved = {};
  }
}
