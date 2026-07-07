import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { opsBatchSchema, type Op } from "@nocturne/core";
import { apiError } from "./errors";
import { authenticate, authFailure, requireApiKey, clearKeyCache } from "./auth";
import { createDashboardSchema, createKeySchema, settingsSchema } from "./validate";
import type { SceneAccess } from "./do/scene";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    // Bearer-token auth, no cookies — a wildcard origin is safe here.
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "X-Nocturne-View-Code"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86_400,
  })
);
app.use(
  "*",
  bodyLimit({
    maxSize: 1024 * 1024, // full setScene documents fit comfortably under 1 MB
    onError: (c) => apiError(c, "too_large", "request body exceeds 1 MB"),
  })
);
app.onError((err, c) => {
  console.error("unhandled error:", err);
  return apiError(c, "internal", "internal error");
});
app.notFound((c) => apiError(c, "not_found", "not found"));

const registry = (env: Env) => env.REGISTRY_DO.get(env.REGISTRY_DO.idFromName("registry"));

async function readJson(c: Parameters<typeof apiError>[0]): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

app.get("/v1/health", (c) => c.json({ ok: true }));

// ── API keys ──────────────────────────────────────────────────────────────
// Bootstrap rule: while zero active keys exist, listing and creation are open
// so first-run setup works without a chicken-and-egg problem. The first
// created key closes the window.

app.get("/v1/keys", async (c) => {
  const reg = registry(c.env);
  const auth = await authenticate(c);
  if (auth.ok) return c.json({ keys: await reg.listKeys(), bootstrap: false });
  if ((await reg.countActiveKeys()) === 0) return c.json({ keys: [], bootstrap: true });
  return authFailure(c, auth.reason);
});

app.post("/v1/keys", async (c) => {
  const reg = registry(c.env);
  const auth = await authenticate(c);
  if (!auth.ok && (await reg.countActiveKeys()) > 0) return authFailure(c, auth.reason);

  const parsed = createKeySchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return apiError(c, "invalid", "invalid key request", z.flattenError(parsed.error));
  }
  const created = await reg.createKey(parsed.data.name);
  // The only response that ever contains the plaintext key.
  return c.json(created, 201);
});

app.delete("/v1/keys/:id", requireApiKey, async (c) => {
  const id = c.req.param("id");
  if (!id) return apiError(c, "invalid", "key id required");
  const { ok } = await registry(c.env).revokeKey(id);
  if (!ok) return apiError(c, "not_found", "no such active key");
  clearKeyCache();
  return c.json({ ok: true });
});

// ── dashboards ────────────────────────────────────────────────────────────

const sceneDO = (env: Env, slug: string) => env.SCENE_DO.get(env.SCENE_DO.idFromName(slug));

/** View codes travel as `?code=` (WS-compatible) or the header (REST). */
const viewCode = (c: { req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined } }) =>
  c.req.query("code") ?? c.req.header("x-nocturne-view-code") ?? null;

app.get("/v1/dashboards", async (c) => {
  return c.json({ dashboards: await registry(c.env).listDashboards() });
});

app.post("/v1/dashboards", requireApiKey, async (c) => {
  const parsed = createDashboardSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return apiError(c, "invalid", "invalid dashboard", z.flattenError(parsed.error));
  }
  const { slug, scene } = parsed.data;
  const name = parsed.data.name ?? slug;
  const created = await registry(c.env).createDashboard(slug, name);
  if (!created.ok) return apiError(c, "conflict", "dashboard already exists");
  await sceneDO(c.env, slug).init({ slug, name, scene: scene ?? null });
  return c.json({ slug, name }, 201);
});

app.delete("/v1/dashboards/:slug", requireApiKey, async (c) => {
  const slug = c.req.param("slug");
  const removed = await registry(c.env).removeDashboard(slug);
  if (!removed.ok) return apiError(c, "not_found", "no such dashboard");
  await sceneDO(c.env, slug).purge();
  return c.json({ ok: true });
});

app.patch("/v1/dashboards/:slug/settings", requireApiKey, async (c) => {
  const slug = c.req.param("slug");
  const parsed = settingsSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return apiError(c, "invalid", "invalid settings", z.flattenError(parsed.error));
  }
  const res = await sceneDO(c.env, slug).patchSettings(parsed.data);
  if (res === null) return apiError(c, "not_found", "no such dashboard");
  if (parsed.data.name !== undefined) {
    await registry(c.env).renameDashboard(slug, parsed.data.name);
  }
  return c.json({ slug, name: res.name, viewCodeRequired: res.viewCodeRequired });
});

app.get("/v1/dashboards/:slug/scene", async (c) => {
  // Cast: wrangler's RPC stub types garble unions in nested properties; the
  // method's declared return type is authoritative (plain JSON over the wire).
  const res = (await sceneDO(c.env, c.req.param("slug")).getSceneFor(viewCode(c))) as SceneAccess;
  if (res.code === "not_found") return apiError(c, "not_found", "no such dashboard");
  if (res.code === "view_code_required") {
    return apiError(c, "view_code_required", "this dashboard requires a view code");
  }
  if (res.code === "forbidden") return apiError(c, "forbidden", "wrong view code");
  return c.json(res.snapshot);
});

// Live updates: read-only WebSocket, gated by the view code inside the DO
// (rejections arrive as app close codes — browsers can't read upgrade errors).
app.get("/v1/dashboards/:slug/live", (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return apiError(c, "invalid", "expected a WebSocket upgrade");
  }
  return sceneDO(c.env, c.req.param("slug")).fetch(c.req.raw);
});

app.post("/v1/dashboards/:slug/ops", requireApiKey, async (c) => {
  const body = await readJson(c);
  const parsed = opsBatchSchema.safeParse(Array.isArray(body) ? body : [body]);
  if (!parsed.success) {
    return apiError(c, "invalid", "invalid ops", z.flattenError(parsed.error));
  }
  const res = await sceneDO(c.env, c.req.param("slug")).applyOps(parsed.data);
  if (res.rev === null) return apiError(c, "not_found", "no such dashboard");
  return c.json({ rev: res.rev });
});

// The curl one-liner: POST any JSON patch straight at a widget.
app.post("/v1/dashboards/:slug/widgets/:wid/data", requireApiKey, async (c) => {
  const body = await readJson(c);
  if (body === undefined) return apiError(c, "invalid", "request body must be JSON");
  const ops: Op[] = [{ type: "pushData", id: c.req.param("wid"), data: body }];
  const res = await sceneDO(c.env, c.req.param("slug")).applyOps(ops);
  if (res.rev === null) return apiError(c, "not_found", "no such dashboard");
  return c.json({ rev: res.rev });
});

export default app;
export { RegistryDO } from "./do/registry";
export { SceneDO } from "./do/scene";
