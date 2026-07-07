import { DurableObject } from "cloudflare:workers";
import { generateApiKey, newKeyId, sha256Hex } from "../keys";

export type DashboardMeta = { slug: string; name: string; createdAt: number };
export type KeyMeta = { id: string; name: string; createdAt: number; lastUsedAt: number | null };
export type CreatedKey = { id: string; name: string; key: string; createdAt: number };

/**
 * Singleton control-plane DO (`idFromName("registry")`): the dashboard index
 * for listing, and the API key records. Only key *hashes* are stored — the
 * plaintext key exists exactly once, in the createKey response.
 */
export class RegistryDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS dashboards (
         slug TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         created_at INTEGER NOT NULL
       )`
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS keys (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         hash TEXT NOT NULL UNIQUE,
         created_at INTEGER NOT NULL,
         last_used_at INTEGER,
         revoked_at INTEGER
       )`
    );
  }

  // ── dashboards ────────────────────────────────────────────────────────────

  listDashboards(): DashboardMeta[] {
    return this.ctx.storage.sql
      .exec(`SELECT slug, name, created_at FROM dashboards ORDER BY created_at`)
      .toArray()
      .map((r) => ({
        slug: r.slug as string,
        name: r.name as string,
        createdAt: r.created_at as number,
      }));
  }

  createDashboard(slug: string, name: string): { ok: true } | { ok: false; code: "conflict" } {
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO dashboards (slug, name, created_at) VALUES (?, ?, ?)`,
        slug,
        name,
        Date.now()
      );
      return { ok: true };
    } catch {
      return { ok: false, code: "conflict" };
    }
  }

  renameDashboard(slug: string, name: string): void {
    this.ctx.storage.sql.exec(`UPDATE dashboards SET name = ? WHERE slug = ?`, name, slug);
  }

  removeDashboard(slug: string): void {
    this.ctx.storage.sql.exec(`DELETE FROM dashboards WHERE slug = ?`, slug);
  }

  // ── API keys ──────────────────────────────────────────────────────────────

  countActiveKeys(): number {
    const row = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) AS n FROM keys WHERE revoked_at IS NULL`)
      .one();
    return row.n as number;
  }

  listKeys(): KeyMeta[] {
    return this.ctx.storage.sql
      .exec(
        `SELECT id, name, created_at, last_used_at FROM keys
         WHERE revoked_at IS NULL ORDER BY created_at`
      )
      .toArray()
      .map((r) => ({
        id: r.id as string,
        name: r.name as string,
        createdAt: r.created_at as number,
        lastUsedAt: (r.last_used_at as number | null) ?? null,
      }));
  }

  async createKey(name: string): Promise<CreatedKey> {
    const key = generateApiKey();
    const id = newKeyId();
    const createdAt = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO keys (id, name, hash, created_at) VALUES (?, ?, ?, ?)`,
      id,
      name,
      await sha256Hex(key),
      createdAt
    );
    return { id, name, key, createdAt };
  }

  revokeKey(id: string): { ok: boolean } {
    const cursor = this.ctx.storage.sql.exec(
      `UPDATE keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
      Date.now(),
      id
    );
    return { ok: cursor.rowsWritten > 0 };
  }

  verifyKey(hash: string): { keyId: string } | null {
    const rows = this.ctx.storage.sql
      .exec(`SELECT id FROM keys WHERE hash = ? AND revoked_at IS NULL`, hash)
      .toArray();
    if (rows.length === 0) return null;
    const keyId = rows[0].id as string;
    // lastUsedAt is cache-granular (the worker only calls this on cache misses).
    this.ctx.storage.sql.exec(`UPDATE keys SET last_used_at = ? WHERE id = ?`, Date.now(), keyId);
    return { keyId };
  }
}
