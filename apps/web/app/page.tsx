"use client";

import { useCallback, useEffect, useState } from "react";
import { ThemeScope } from "@/components/display/ThemeScope";
import { observatory } from "@nocturne/core/themes";
import {
  api,
  ApiError,
  type CreatedKey,
  type DashboardMeta,
  type KeyMeta,
} from "@/lib/remote/client";
import { getApiKey, getApiUrl, setApiKey } from "@/lib/remote/config";

const panel = "n-surface flex flex-col gap-4 p-6";
const input =
  "n-data rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-40";
const inputBorder = { border: "1px solid rgba(255,255,255,0.12)", color: "var(--n-text1)" };
const button =
  "n-label cursor-pointer rounded-md px-3 py-2 transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-30";
const buttonBorder = { border: "1px solid rgba(255,255,255,0.08)", color: "var(--n-accent1)" };
const quietButton = { border: "1px solid rgba(255,255,255,0.08)", color: "var(--n-text2)" };
const dangerButton = { border: "1px solid rgba(255,255,255,0.08)", color: "var(--n-negative)" };

function fmtDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── API keys ────────────────────────────────────────────────────────────────

function KeysPanel({
  hasKey,
  onKeyChanged,
}: {
  hasKey: boolean;
  onKeyChanged: () => void;
}) {
  const [keys, setKeys] = useState<KeyMeta[] | null>(null);
  const [bootstrap, setBootstrap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listKeys();
      setKeys(res.keys);
      setBootstrap(res.bootstrap);
    } catch (e) {
      setKeys(null);
      if (e instanceof ApiError && e.code === "unreachable") {
        setError("server unreachable — is it running? (pnpm dev:server)");
      } else if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setKeys([]);
        setBootstrap(false);
        setError(hasKey ? "stored key was rejected — paste a valid one" : null);
      } else {
        setError(e instanceof Error ? e.message : "failed to load keys");
      }
    }
  }, [hasKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const key = await api.createKey(name.trim());
      setCreated(key);
      setCopied(false);
      setName("");
      // First key in this browser: adopt it so the drawer and admin work at once.
      if (!getApiKey()) {
        setApiKey(key.key);
        onKeyChanged();
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to create key");
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.revokeKey(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to revoke key");
    }
  };

  const adoptPasted = () => {
    const k = pasted.trim();
    if (!k) return;
    setApiKey(k);
    setPasted("");
    onKeyChanged();
    void refresh();
  };

  const canList = keys !== null && keys.length >= 0 && hasKey && !bootstrap;

  return (
    <section className={panel}>
      <div className="n-label">API keys</div>

      {error && (
        <div className="n-data text-sm" style={{ color: "var(--n-negative)" }}>
          {error}
        </div>
      )}

      {created && (
        <div
          className="flex flex-col gap-3 rounded-md p-4"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div className="n-label" style={{ color: "var(--n-accent1)" }}>
            key created — shown exactly once
          </div>
          <code className="n-data break-all text-sm" style={{ color: "var(--n-text1)" }}>
            {created.key}
          </code>
          <div className="flex gap-2">
            <button
              className={button}
              style={buttonBorder}
              onClick={() => {
                void navigator.clipboard.writeText(created.key).then(() => setCopied(true));
              }}
            >
              {copied ? "copied" : "copy"}
            </button>
            <button className={button} style={quietButton} onClick={() => setCreated(null)}>
              done
            </button>
          </div>
        </div>
      )}

      {bootstrap && !created && (
        <div className="flex flex-col gap-3">
          <div className="n-data text-sm" style={{ color: "var(--n-text2)" }}>
            No API keys exist yet. Create the first one — it authorizes every write
            (widget data, ops, dashboard management), so do this before exposing the
            server to the internet.
          </div>
          <div className="flex gap-2">
            <input
              className={`${input} flex-1`}
              style={inputBorder}
              placeholder="key name, e.g. laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void create()}
            />
            <button className={button} style={buttonBorder} onClick={() => void create()}>
              create first key
            </button>
          </div>
        </div>
      )}

      {!bootstrap && !hasKey && keys !== null && (
        <div className="flex flex-col gap-2">
          <div className="n-data text-sm" style={{ color: "var(--n-text2)" }}>
            This browser has no API key. Paste one to manage keys and dashboards.
          </div>
          <div className="flex gap-2">
            <input
              className={`${input} flex-1`}
              style={inputBorder}
              placeholder="noct_…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adoptPasted()}
            />
            <button className={button} style={buttonBorder} onClick={adoptPasted}>
              use key
            </button>
          </div>
        </div>
      )}

      {canList && (
        <>
          <ul className="flex flex-col gap-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="n-data truncate text-sm">{k.name}</span>
                  <span className="n-label opacity-60">
                    created {fmtDate(k.createdAt)} · used {fmtDate(k.lastUsedAt)}
                  </span>
                </div>
                <button className={button} style={dangerButton} onClick={() => void revoke(k.id)}>
                  revoke
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className={`${input} flex-1`}
              style={inputBorder}
              placeholder="new key name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void create()}
            />
            <button className={button} style={buttonBorder} onClick={() => void create()}>
              create key
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── dashboards ──────────────────────────────────────────────────────────────

function DashboardRow({
  dash,
  hasKey,
  onChanged,
  onError,
}: {
  dash: DashboardMeta;
  hasKey: boolean;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [code, setCode] = useState("");
  const [editingCode, setEditingCode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setViewCode = async (value: string | null) => {
    try {
      await api.patchSettings(dash.slug, { viewCode: value });
      setEditingCode(false);
      setCode("");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "failed to update view code");
    }
  };

  const remove = async () => {
    try {
      await api.deleteDashboard(dash.slug);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "failed to delete dashboard");
    }
  };

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 rounded-md p-3"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex min-w-0 flex-col">
        <span className="n-data text-sm" style={{ color: "var(--n-text1)" }}>
          {dash.name}
        </span>
        <span className="n-label opacity-60">
          {dash.slug} · created {fmtDate(dash.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {editingCode ? (
          <>
            <input
              autoFocus
              className={input}
              style={{ ...inputBorder, width: 120 }}
              placeholder="view code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code.trim() && void setViewCode(code.trim())}
            />
            <button
              className={button}
              style={buttonBorder}
              disabled={!code.trim()}
              onClick={() => void setViewCode(code.trim())}
            >
              lock
            </button>
            <button className={button} style={quietButton} onClick={() => void setViewCode(null)}>
              unlock
            </button>
            <button className={button} style={quietButton} onClick={() => setEditingCode(false)}>
              cancel
            </button>
          </>
        ) : confirmDelete ? (
          <>
            <button className={button} style={dangerButton} onClick={() => void remove()}>
              really delete
            </button>
            <button className={button} style={quietButton} onClick={() => setConfirmDelete(false)}>
              keep
            </button>
          </>
        ) : (
          <>
            <a
              className={button}
              style={buttonBorder}
              href={`/d/${encodeURIComponent(dash.slug)}`}
            >
              open
            </a>
            <button
              className={button}
              style={quietButton}
              disabled={!hasKey}
              onClick={() => setEditingCode(true)}
            >
              view code
            </button>
            <button
              className={button}
              style={dangerButton}
              disabled={!hasKey}
              onClick={() => setConfirmDelete(true)}
            >
              delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function DashboardsPanel({ hasKey }: { hasKey: boolean }) {
  const [dashboards, setDashboards] = useState<DashboardMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    try {
      setDashboards(await api.listDashboards());
      setError(null);
    } catch (e) {
      setDashboards(null);
      setError(
        e instanceof ApiError && e.code === "unreachable"
          ? "server unreachable"
          : e instanceof Error
            ? e.message
            : "failed to load dashboards"
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    setError(null);
    try {
      await api.createDashboard(s, name.trim() || undefined);
      setSlug("");
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to create dashboard");
    }
  };

  return (
    <section className={panel}>
      <div className="n-label">Dashboards</div>

      {error && (
        <div className="n-data text-sm" style={{ color: "var(--n-negative)" }}>
          {error}
        </div>
      )}

      {dashboards !== null && dashboards.length === 0 && (
        <div className="n-data text-sm" style={{ color: "var(--n-text2)" }}>
          No dashboards yet.
        </div>
      )}

      {dashboards !== null && dashboards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {dashboards.map((d) => (
            <DashboardRow
              key={d.slug}
              dash={d}
              hasKey={hasKey}
              onChanged={() => void refresh()}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className={input}
          style={{ ...inputBorder, width: 160 }}
          placeholder="slug, e.g. living-room"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          className={`${input} flex-1`}
          style={inputBorder}
          placeholder="display name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
        />
        <button
          className={button}
          style={buttonBorder}
          disabled={!hasKey || !slug.trim()}
          onClick={() => void create()}
        >
          create
        </button>
      </div>
      {!hasKey && (
        <div className="n-label opacity-60">managing dashboards requires an API key</div>
      )}
    </section>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [hasKey, setHasKey] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  useEffect(() => {
    setHasKey(getApiKey() !== null);
    setApiUrl(getApiUrl());
  }, []);

  return (
    <ThemeScope theme={observatory} tier={2}>
      <main
        className="min-h-screen w-full"
        style={{ background: "var(--n-bg0)", color: "var(--n-text1)" }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
          <header className="flex items-baseline justify-between">
            <h1
              className="text-2xl"
              style={{ fontFamily: "var(--n-font-display)", color: "var(--n-text1)" }}
            >
              Nocturne
            </h1>
            <span className="n-label opacity-60">{apiUrl}</span>
          </header>

          <KeysPanel hasKey={hasKey} onKeyChanged={() => setHasKey(getApiKey() !== null)} />
          <DashboardsPanel hasKey={hasKey} />

          <footer className="n-label opacity-40">
            push data: curl -X POST {apiUrl || "http://localhost:8787"}
            /v1/dashboards/&lt;slug&gt;/widgets/&lt;id&gt;/data -H &quot;Authorization: Bearer
            $KEY&quot; -d &apos;{"{"}&quot;value&quot;:73{"}"}&apos;
          </footer>
        </div>
      </main>
    </ThemeScope>
  );
}
