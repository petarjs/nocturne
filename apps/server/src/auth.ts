import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { API_KEY_PATTERN, sha256Hex } from "./keys";
import { apiError } from "./errors";

export type AuthResult = { ok: true } | { ok: false; reason: "missing" | "invalid" };

// Verified-hash cache so writes don't pay a registry hop per request. Same-isolate
// revocation clears it immediately; cross-isolate staleness is bounded by the TTL
// (moot under wrangler dev, which is a single isolate).
const cache = new Map<string, { valid: boolean; expires: number }>();
const HIT_TTL_MS = 30_000;
const MISS_TTL_MS = 5_000;

export function clearKeyCache(): void {
  cache.clear();
}

function registry(env: Env) {
  return env.REGISTRY_DO.get(env.REGISTRY_DO.idFromName("registry"));
}

export async function authenticate(c: Context<{ Bindings: Env }>): Promise<AuthResult> {
  const header = c.req.header("authorization");
  if (!header) return { ok: false, reason: "missing" };
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match || !API_KEY_PATTERN.test(match[1])) return { ok: false, reason: "invalid" };

  const hash = await sha256Hex(match[1]);
  const now = Date.now();
  const cached = cache.get(hash);
  if (cached && cached.expires > now) {
    return cached.valid ? { ok: true } : { ok: false, reason: "invalid" };
  }

  const hit = await registry(c.env).verifyKey(hash);
  cache.set(hash, {
    valid: hit !== null,
    expires: now + (hit !== null ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return hit !== null ? { ok: true } : { ok: false, reason: "invalid" };
}

/** 401 when no key was sent, 403 when one was sent but is wrong or revoked. */
export function authFailure(c: Context<{ Bindings: Env }>, reason: "missing" | "invalid") {
  return reason === "missing"
    ? apiError(c, "unauthorized", "API key required (Authorization: Bearer noct_…)")
    : apiError(c, "forbidden", "invalid or revoked API key");
}

export const requireApiKey = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const auth = await authenticate(c);
  if (!auth.ok) return authFailure(c, auth.reason);
  await next();
});
