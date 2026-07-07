import type { Op, Scene } from "@nocturne/core";
import { getApiKey, getApiUrl } from "./config";

export type DashboardMeta = { slug: string; name: string; createdAt: number };
export type KeyMeta = { id: string; name: string; createdAt: number; lastUsedAt: number | null };
export type CreatedKey = { id: string; name: string; key: string; createdAt: number };
export type SceneSnapshot = { rev: number; scene: Scene; name: string; viewCodeRequired: boolean };

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Override the stored key (e.g. before it's saved during first-run). */
  apiKey?: string | null;
  viewCode?: string | null;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const key = opts.apiKey !== undefined ? opts.apiKey : getApiKey();
  if (key) headers["authorization"] = `Bearer ${key}`;
  if (opts.viewCode) headers["x-nocturne-view-code"] = opts.viewCode;

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("unreachable", 0, "server unreachable");
  }

  const json = (await res.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string } })
    | null;
  if (!res.ok) {
    const err = json && "error" in (json as object) ? (json as { error: { code: string; message: string } }).error : null;
    throw new ApiError(err?.code ?? "internal", res.status, err?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export const api = {
  listDashboards: () =>
    request<{ dashboards: DashboardMeta[] }>("/v1/dashboards").then((r) => r.dashboards),

  createDashboard: (slug: string, name?: string) =>
    request<{ slug: string; name: string }>("/v1/dashboards", {
      method: "POST",
      body: { slug, ...(name ? { name } : {}) },
    }),

  deleteDashboard: (slug: string) =>
    request<{ ok: true }>(`/v1/dashboards/${encodeURIComponent(slug)}`, { method: "DELETE" }),

  patchSettings: (slug: string, patch: { name?: string; viewCode?: string | null }) =>
    request<{ slug: string; name: string; viewCodeRequired: boolean }>(
      `/v1/dashboards/${encodeURIComponent(slug)}/settings`,
      { method: "PATCH", body: patch }
    ),

  getScene: (slug: string, viewCode?: string | null) =>
    request<SceneSnapshot>(`/v1/dashboards/${encodeURIComponent(slug)}/scene`, { viewCode }),

  postOps: (slug: string, ops: Op[]) =>
    request<{ rev: number }>(`/v1/dashboards/${encodeURIComponent(slug)}/ops`, {
      method: "POST",
      body: ops,
    }),

  listKeys: (apiKey?: string | null) =>
    request<{ keys: KeyMeta[]; bootstrap: boolean }>("/v1/keys", { apiKey }),

  createKey: (name: string, apiKey?: string | null) =>
    request<CreatedKey>("/v1/keys", { method: "POST", body: { name }, apiKey }),

  revokeKey: (id: string) =>
    request<{ ok: true }>(`/v1/keys/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
