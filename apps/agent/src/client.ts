// Typed REST client for the Nocturne server. Mirrors the fetch shapes and
// view-code handling in scripts/lib/nocturne-client.mjs, but typed against
// @nocturne/core and with structured error parsing.

import type { Scene, Op } from "@nocturne/core";

export type DashboardMeta = { slug: string; name: string; createdAt: number };
export type SceneResponse = { rev: number; scene: Scene; name: string; viewCodeRequired: boolean };
export type KeyResponse = { id: string; name: string; key: string; createdAt: number };

export class NocturneError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "NocturneError";
  }
}

export class NocturneClient {
  private readonly api: string;
  private key?: string;
  private readonly viewCode?: string;

  constructor(opts: { api: string; key?: string; viewCode?: string }) {
    this.api = opts.api.replace(/\/+$/, "");
    this.key = opts.key;
    this.viewCode = opts.viewCode;
  }

  setKey(key: string): void {
    this.key = key;
  }

  private async request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
    if (init.body != null) headers["content-type"] = "application/json";
    if (init.auth) {
      if (!this.key) throw new NocturneError("no API key configured", 401, "unauthorized");
      headers["authorization"] = `Bearer ${this.key}`;
    }
    if (this.viewCode) headers["x-nocturne-view-code"] = this.viewCode;

    const res = await fetch(`${this.api}${path}`, { ...init, headers });
    const text = await res.text();
    const body = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const err = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error ?? {};
      throw new NocturneError(err.message || text || res.statusText, res.status, err.code, err.details);
    }
    return body as T;
  }

  health(): Promise<{ ok: boolean }> {
    return this.request("/v1/health");
  }

  listDashboards(): Promise<{ dashboards: DashboardMeta[] }> {
    return this.request("/v1/dashboards");
  }

  getScene(dash: string): Promise<SceneResponse> {
    return this.request(`/v1/dashboards/${encodeURIComponent(dash)}/scene`);
  }

  createDashboard(input: { slug: string; name?: string; scene?: Scene }): Promise<{ slug: string; name: string }> {
    return this.request("/v1/dashboards", { method: "POST", body: JSON.stringify(input), auth: true });
  }

  applyOps(dash: string, ops: Op[] | Op): Promise<{ rev: number }> {
    return this.request(`/v1/dashboards/${encodeURIComponent(dash)}/ops`, {
      method: "POST",
      body: JSON.stringify(ops),
      auth: true,
    });
  }

  pushData(dash: string, widgetId: string, data: unknown): Promise<{ rev: number }> {
    return this.request(`/v1/dashboards/${encodeURIComponent(dash)}/widgets/${encodeURIComponent(widgetId)}/data`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    });
  }

  /** Mint the first API key — only works while zero keys exist (server bootstrap). */
  bootstrapKey(name: string): Promise<KeyResponse> {
    return this.request("/v1/keys", { method: "POST", body: JSON.stringify({ name }) });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
