# @nocturne/agent

An LLM agent that drives a Nocturne dashboard in natural language — the
"compositor you can talk to." Say _"put my homelab up"_ or _"make it feel like
cyberpunk noir"_ and it composes widgets, narrative, theme, and mood into the
existing `/v1/dashboards/:slug/ops` API. Built on the [Vercel AI SDK](https://ai-sdk.dev)
+ Claude; runs locally, no external platform required.

It's a **client** of the Nocturne server — the same one you drive with `curl` or
`scripts/beats.sh`. Everything it can do is a validated batch of scene ops, so the
blast radius is pixels.

## Setup

```bash
# from the repo root
pnpm install
cp apps/agent/.env.example apps/agent/.env      # then fill in ANTHROPIC_API_KEY
```

You need the server running and a dashboard to target:

```bash
pnpm dev:server            # Nocturne API on :9876
# open the display for the dashboard on your TV/browser:
#   http://localhost:3000/d/living-room
```

On first run the agent will mint a bootstrap API key (if none exists) and create
the target dashboard if it's missing, then print the display URL.

## Usage

```bash
# interactive terminal chat (default)
pnpm dev:agent

# one-shot command
pnpm dev:agent -- "make it feel like a rainy Tokyo night"

# autonomous mode: reason over the live data and react, every N minutes
pnpm dev:agent -- tick --interval 5m
pnpm dev:agent -- tick --once            # a single pass (good for cron/launchd)
```

Load env from the file directly if you're not exporting it:

```bash
node --env-file=apps/agent/.env --import tsx apps/agent/src/index.ts
```

### Modes

- **chat** — interactive TUI (streamed replies, tool cards). Destructive ops
  (`removeWidget`, `setScene`, `saveScene`, `loadScene`) ask for a y/n first.
- **one-shot** — any non-subcommand text runs to completion and exits.
- **tick** — autonomous: reads the scene + data on an interval and acts only when
  something meaningful changed (narrate a change, react to an anomaly), otherwise
  stays quiet. Destructive ops are disabled in this mode.

### Flags

| Flag | Env | Default |
|---|---|---|
| `-d, --dashboard <slug>` | `NOCTURNE_DASH` | `living-room` |
| `-m, --model <id>` | `NOCTURNE_AGENT_MODEL` | `claude-sonnet-5` |
| `--tick-model <id>` | `NOCTURNE_TICK_MODEL` | = model |
| `--interval <30s\|10m\|1h>` | `NOCTURNE_TICK_INTERVAL` | `10m` |
| `--api <url>` | `NOCTURNE_API` | `http://localhost:9876` |
| `--web <url>` | `NOCTURNE_WEB` | `http://localhost:3000` |
| `--once` | — | run one tick and exit |
| `--dry-run` | — | validate + print ops, don't send |
| `-y, --yes` | — | skip approval prompts |

## How it works

- **Capabilities** come from the repo's [`AGENT_API.md`](../../AGENT_API.md), loaded
  verbatim as the system prompt's backbone (single source of truth), plus a compact
  live-scene summary refreshed via `get_scene`.
- **Tools** (`get_scene`, `apply_ops`, `push_data`, `set_vibe`, `list_dashboards`)
  mirror the planned MCP surface. `apply_ops` validates against the shared
  `@nocturne/core` `opsBatchSchema` **before** sending, so the model self-corrects
  on bad ops rather than hitting a 400.
- **Custom themes** (`set_vibe`) are contrast-clamped (text1 vs bg0 ≥ 4.5:1) before
  they're applied — invalid themes stay unrepresentable.

## Not yet

Web/phone chat surfaces, a real server-side MCP server, and the not-yet-rendered
presets (`nowPlaying`, `weather`, `image`, `video`, `composite`) — the agent is
constrained to the presets that render today.
