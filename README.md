# Nocturne

A living display for AI agents — a persistent, stateful screen that agents (or a
curl one-liner) render onto. The full product spec lives in [CLAUDE.md](CLAUDE.md).

```
apps/web        Next.js display + admin UI          :3000
apps/server     Hono on workerd (wrangler dev)      :9876
                ├─ SceneDO    one Durable Object per dashboard: scene, op log,
                │             view code, live WebSockets
                └─ RegistryDO dashboard index + hashed API keys
packages/core   @nocturne/core — scene schema, ops, pure reducer, themes,
                fixtures, WS protocol (shared by browser and server)
```

The server runs **locally** (workerd via `wrangler dev`, state persisted in
`apps/server/data/`) and is exposed to the internet with a Cloudflare Tunnel.
The same worker deploys unchanged to Cloudflare (`pnpm --filter @nocturne/server deploy`)
if you ever want it hosted.

## Quickstart

```bash
pnpm install
pnpm dev            # web on :3000 + server on :9876
```

1. Open http://localhost:3000 — the admin page.
2. Create your **first API key** (open while zero keys exist; the first key
   closes that window — do this before exposing the tunnel).
3. Create a dashboard (e.g. `living-room`) and click **open**, or go to
   `http://localhost:3000/d/living-room`.
4. Push data at it:

```bash
curl -X POST http://localhost:9876/v1/dashboards/living-room/widgets/cpu/data \
  -H "Authorization: Bearer $NOCTURNE_KEY" \
  -d '{"value":73}'
```

Every browser on that dashboard updates live over WebSocket. `/display` (dev
only, gated out of production builds) runs local fixture mode — what the
golden tests capture.

The demo runbook drives all six beats end-to-end:

```bash
NOCTURNE_KEY=noct_… ./scripts/beats.sh
```

## API

For an LLM-agent-ready reference (endpoints, ops, widget schemas, moments,
themes), see [AGENT_API.md](AGENT_API.md) — feed that file to whatever agent
you're wiring up to a dashboard.

All routes under `http://localhost:9876/v1`. Writes need
`Authorization: Bearer noct_…`; reads are open unless the dashboard has a view
code (`?code=` or `X-Nocturne-View-Code`).

| Method | Path | Auth | |
|---|---|---|---|
| GET | `/v1/dashboards` | — | list dashboards |
| POST | `/v1/dashboards` | key | `{slug, name?, scene?}` |
| DELETE | `/v1/dashboards/:slug` | key | delete (closes live sockets) |
| PATCH | `/v1/dashboards/:slug/settings` | key | `{name?, viewCode?: string\|null}` |
| GET | `/v1/dashboards/:slug/scene` | code? | `{rev, scene, …}` |
| POST | `/v1/dashboards/:slug/ops` | key | `Op \| Op[]` (see `packages/core/src/schema/ops.ts`) |
| POST | `/v1/dashboards/:slug/widgets/:wid/data` | key | any JSON → `pushData` |
| GET | `/v1/dashboards/:slug/live` | code? | WebSocket: `sync` on connect, `ops` frames on change |
| GET/POST | `/v1/keys` · DELETE `/v1/keys/:id` | key¹ | manage API keys (hashes only at rest) |

¹ open while zero active keys exist (first-run bootstrap); revoking the last
key re-opens it.

High-frequency `pushData` is coalesced server-side to ≤4 WebSocket frames/sec.
Rate limiting beyond that is deliberately deferred — this is a personal tool
behind an unguessable tunnel URL plus an API key.

## Exposing it with a Cloudflare Tunnel

WebSockets work through cloudflared unchanged (`brew install cloudflared`).

**Quick tunnels** (zero config; URLs rotate every run):

```bash
pnpm tunnel        # → https://<random>.trycloudflare.com  → :9876 (API)
pnpm tunnel:web    # → https://<random>.trycloudflare.com  → :3000 (UI)
```

Open the display through the web tunnel and point it at the API tunnel once:

```
https://<web-tunnel>/d/living-room?api=https://<api-tunnel>
```

`?api=` persists to localStorage, so when the API tunnel URL rotates you only
pass it again once. Agents and cron jobs push straight at
`https://<api-tunnel>/v1/...` with the bearer key.

**Named tunnel** (stable hostnames, one tunnel for both):

```yaml
# ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /Users/you/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: api.example.com
    service: http://localhost:9876
  - hostname: dash.example.com
    service: http://localhost:3000
  - service: http_status:404
```

With stable hostnames, set `NEXT_PUBLIC_API_URL=https://api.example.com` in
`apps/web/.env.local` (or keep using `?api=` once per browser).

Before exposing anything: create your first API key, and put view codes on
dashboards you don't want publicly viewable (admin page → dashboard → view
code). The blast radius of a leaked *view* is pixels; writes always need a key.

## Development

```bash
pnpm dev:web / pnpm dev:server   # each side alone
pnpm build                       # next build + wrangler dry-run
pnpm typecheck                   # all three packages
pnpm test:golden                 # golden frames (display in local fixture mode)
```

Server state (dashboards, keys, scenes) lives in `apps/server/data/` —
delete it for a factory reset.
