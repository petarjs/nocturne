import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { apiError } from "./errors";
import { authenticate, authFailure, requireApiKey, clearKeyCache } from "./auth";
import { createKeySchema } from "./validate";

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

app.get("/v1/dashboards", async (c) => {
  return c.json({ dashboards: await registry(c.env).listDashboards() });
});

export default app;
export { RegistryDO } from "./do/registry";
export { SceneDO } from "./do/scene";
