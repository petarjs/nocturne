import { DurableObject } from "cloudflare:workers";
import { reduce, type Op, type Scene } from "@nocturne/core";
import { scenePresets } from "@nocturne/core/fixtures";

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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS oplog (
         rev INTEGER PRIMARY KEY,
         ops TEXT NOT NULL,
         at INTEGER NOT NULL
       )`
    );
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

    return { rev: this.rev };
  }

  async patchSettings(patch: {
    name?: string;
    viewCode?: string | null;
  }): Promise<{ name: string; viewCodeRequired: boolean } | null> {
    if (!this.meta) return null;
    if (patch.name !== undefined) this.meta.name = patch.name;
    if (patch.viewCode !== undefined) this.meta.viewCode = patch.viewCode;
    await this.ctx.storage.put("meta", this.meta);
    return { name: this.meta.name, viewCodeRequired: this.meta.viewCode !== null };
  }

  async purge(): Promise<void> {
    this.ctx.storage.sql.exec(`DELETE FROM oplog`);
    await this.ctx.storage.deleteAll();
    this.scene = null;
    this.meta = null;
    this.rev = 0;
    this.saved = {};
  }
}
