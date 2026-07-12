# Nocturne — agent API reference

This file is written to be fed directly to an LLM agent (system prompt, tool
description, or context) so it knows how to drive a Nocturne display over
HTTP. For product intent and design rules see [CLAUDE.md](CLAUDE.md); for
human setup (install, tunnels) see [README.md](README.md). This doc only
covers what an agent needs to call the API correctly.

## What this is

Nocturne is a **push surface**: a wall display that renders whatever JSON
document ("scene") you send it. You don't draw pixels — you describe widgets
and a narrative (what's the hero, what's supporting), and the display
composes, themes, and animates it for you. There is currently no MCP server;
everything below is plain REST + one WebSocket for live updates.

## Concepts

The API is deliberately narrow so an agent can't produce a bad-looking
screen. Internalize these before composing scenes:

**Narrative roles, not coordinates.** You never say where a widget goes.
Every widget gets a role — `hero`, `supporting`, or `ambient` — and a
layout engine turns that into geometry, deterministically, the same way
every time. This exists because LLMs are good at telling a story ("CPU is
the thing that matters right now") and bad at pixel math ("put it at
x=480, y=120, 6 columns wide"). Think of it like writing a shot list for a
film editor, not laying out a poster.

- **`hero`** — at most one per act. The one thing this screen is *about*
  right now. Gets the most space, a subtle glow, and is the widget that
  gets promoted here automatically when something alarms (see mood below).
  If you don't set a hero, the layout engine promotes the first supporting
  widget instead — don't rely on that, pick a hero on purpose.
- **`supporting`** — up to four. Secondary context, sized smaller than
  hero but still prominent. If you have more than four things that matter,
  that's a signal to split into acts (below), not to cram them in.
- **`ambient`** — everything else. Peripheral, low-visual-weight — a strip
  along the bottom or a side rail. Good for things that are nice to glance
  at but never the point (a clock, a low-priority status list).

Widgets not mentioned in any role for the current act simply aren't shown.

**Anchors** are widget ids that persist across *every* act — put your clock
or a persistent alert rail here so it doesn't disappear when the story
rotates to a different chapter.

**Acts** are chapters. A single screen only fits so much (roughly 1 hero +
4 supporting + a handful of ambient). If you have more to show, or you want
a narrated sequence ("first infrastructure, then media"), define multiple
acts in `narrative.acts` and turn on `rotation` (`mode: "story"` if you're
authoring the sequence yourself, `"auto"` to let the engine pack and spill
automatically). The display cycles acts on a dwell timer, and shared
widgets *travel* to their new slot rather than disappearing and
reappearing — continuity is the point, it should read like chapters, not
pagination.

**Position is otherwise sacred.** Once an act is laid out, widgets don't
move around on their own — no random reshuffling, ever. The only things
that legitimately reposition a widget are: changing its role via
`updateWidget`/`setNarrative`, an act transition, or an alert promoting it
to hero. If you want a widget somewhere permanently regardless of role
churn, `pinWidget` is the (rare) manual override.

**Mood** is the scene's overall emotional state, separate from any one
widget — it's the difference between "everything's fine, ambient
background motion" and "something's wrong, pay attention":

- `ambient` — default, normal operation, background breathes gently.
- `focus` — hero is emphasized, everything else dims to 80% and slows.
  Use this when you want to draw attention to one thing without it being
  an actual alert (e.g. "here's tonight's summary").
- `alert` — entered automatically whenever a widget reaches tier `t3`
  (see **Moments** below): that widget is promoted toward hero, its color
  bleeds into the screen edges, everything else dims and slows. You rarely
  set this directly — it's a *consequence* of data crossing a critical
  threshold, not something you narrate into.
- `sleep` — near-black, just a clock. Use this for "good night" — nothing
  else should be showing.

**Moments** (`t0`–`t3`) are how a single data change escalates from silent
to screen-wide alert, and mood + moments are linked: reaching `t3` on any
widget is what puts the whole scene into `alert` mood automatically. See
the dedicated **Moments** section below for the trigger rules — the
takeaway here is you almost never call `setMood` yourself for alerts; you
push data, the display decides how loudly to react.

## Base URL and auth

All routes are under `{API_URL}/v1` (locally `http://localhost:9876/v1`).

- **Reads** (`GET .../scene`, `GET /v1/dashboards`) are open, unless the
  dashboard has a *view code* set, in which case pass `?code=<code>` or the
  `X-Nocturne-View-Code` header.
- **Writes** (everything else) require `Authorization: Bearer <key>`, where
  `<key>` looks like `noct_…`. Get one from the admin UI (`/`) or `POST
  /v1/keys` while zero keys exist yet (first-run bootstrap only).
- Errors are JSON: `{"error": {"code": "...", "message": "...", "details"?: ...}}`.
  Codes: `unauthorized` (401), `view_code_required` (401), `forbidden` (403),
  `not_found` (404), `conflict` (409), `invalid` (400, usually a Zod
  validation failure — check `details`), `too_large` (413), `internal` (500).

## Endpoints

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | `/v1/health` | — | `{ok: true}` |
| GET | `/v1/dashboards` | — | list `{slug, name, createdAt}[]` |
| POST | `/v1/dashboards` | key | `{slug, name?, scene?}` — `slug` is lowercase-kebab, ≤64 chars; `scene` optional, defaults to a blank "minimal" scene |
| DELETE | `/v1/dashboards/:slug` | key | deletes and closes live sockets |
| PATCH | `/v1/dashboards/:slug/settings` | key | `{name?, viewCode?: string\|null}` |
| GET | `/v1/dashboards/:slug/scene` | code? | `{rev, scene, name, viewCodeRequired}` — full current document |
| POST | `/v1/dashboards/:slug/ops` | key | one `Op` or `Op[]` — see **Ops** below |
| POST | `/v1/dashboards/:slug/widgets/:wid/data` | key | any JSON object — shorthand for `pushData` (see below) |
| GET | `/v1/dashboards/:slug/live` | code? | WebSocket. `sync` frame on connect with the full scene; `ops` frames after |
| GET/POST | `/v1/keys` · DELETE `/v1/keys/:id` | key¹ | manage API keys |

¹ open while zero active keys exist.

The display itself lives at `{WEB_URL}/d/<slug>` (e.g.
`http://localhost:3000/d/living-room`) — that's what you point a TV/browser
at. Agents never need to open it; you just push data at the API.

### The one-liner

```bash
curl -X POST "$API_URL/v1/dashboards/living-room/widgets/cpu/data" \
  -H "Authorization: Bearer $NOCTURNE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value": 73}'
```

This shallow-merges `{"value": 73}` into that widget's existing `data`
(`mergeWidgetData` — object keys merge, so you only need to send what
changed). It's sugar for `POST .../ops` with one `pushData` op.

## Creating a dashboard

```bash
curl -X POST "$API_URL/v1/dashboards" \
  -H "Authorization: Bearer $NOCTURNE_KEY" -H "Content-Type: application/json" \
  -d '{"slug": "living-room", "name": "Living Room"}'
```

Omit `scene` to start blank (clock + a headline). To start with widgets
already in place, pass a full `scene` object matching the shape in **Scene
document** below.

## Ops — the only way to mutate a scene

`POST /v1/dashboards/:slug/ops` takes one op object or an array (apply in
order, atomically). **No coordinates anywhere** — you place widgets into
narrative roles (hero / supporting / ambient) and the layout engine does the
geometry.

| Op | Fields | Effect |
|---|---|---|
| `addWidget` | `widget: Widget` | adds a widget (see **Widget shape**); no-op if the id already exists |
| `removeWidget` | `id` | removes it and scrubs it from narrative/anchors |
| `updateWidget` | `id, patch` | shallow-merges `patch` onto the widget (title, data, thresholds, accent, state, …) |
| `pinWidget` | `id, pinned` | manual position lock — the only escape hatch from automatic layout |
| `pushData` | `id, data` | high-frequency data merge; **use the one-liner endpoint for this instead** unless batching with other ops |
| `setNarrative` | `narrative` | replaces the whole narrative (anchors + acts + rotation) in one shot |
| `setActs` | `acts` | replaces just the acts array |
| `setRotation` | `rotation: {mode: "off"\|"auto"\|"story", dwellSec, indicator: "none"\|"hairline"}` | controls act rotation |
| `setTheme` | `theme: {preset: string}` or full `ThemeTokens` | switch theme; prefer `{preset: "kanso"}` — see **Themes** |
| `setBackground` | `engine, preset?, params?` | override just the background engine on the current (non-preset) theme |
| `setMood` | `mood: "ambient"\|"focus"\|"alert"\|"sleep"` | scene-level mood |
| `triggerMoment` | `id, tier: "t0"\|"t1"\|"t2"\|"t3"` | force a moment on a widget without a data push; `t3` also sets mood to `alert` and the widget state to `critical` |
| `setScene` | `scene: Scene` | replace the entire document |
| `saveScene` / `loadScene` | `name` | snapshot/recall a named scene server-side, scoped to that dashboard |

Example — build a "hero + two supporting" story in one call:

```bash
curl -X POST "$API_URL/v1/dashboards/living-room/ops" \
  -H "Authorization: Bearer $NOCTURNE_KEY" -H "Content-Type: application/json" \
  -d '[
    {"type": "addWidget", "widget": {"id": "cpu", "type": "stat", "title": "CPU Load",
      "data": {"label": "CPU", "value": 42, "unit": "%"}, "thresholds": {"t1": 10, "t2": 25}, "state": "normal"}},
    {"type": "addWidget", "widget": {"id": "mem", "type": "gauge", "title": "Memory",
      "data": {"label": "Memory", "value": 60, "min": 0, "max": 100, "warn": 80, "crit": 92}, "state": "normal"}},
    {"type": "addWidget", "widget": {"id": "net", "type": "timeseries", "title": "Network",
      "data": {"label": "Network", "series": [{"t": 0, "v": 10}, {"t": 1, "v": 12}]}, "state": "normal"}},
    {"type": "setNarrative", "narrative": {
      "anchors": ["clock"],
      "acts": [{"hero": "cpu", "supporting": ["mem", "net"], "ambient": ["clock"]}],
      "rotation": {"mode": "off", "dwellSec": 20, "indicator": "none"}
    }}
  ]'
```

Rules for narrative: at most one `hero`, up to four `supporting`, any number
`ambient`. Every widget id referenced in an act must exist as a widget.
`anchors` are widgets that persist across every act (e.g. a clock). If you
have more widgets than fit one screen, use multiple acts + `rotation.mode:
"story"` and the display cycles through them like chapters.

## Widget shape

```ts
{
  id: string,               // unique within the dashboard
  type: PresetType,         // see table below
  title?: string,
  data: unknown,            // shape depends on type — see table below
  accent?: "accent1" | "accent2",
  thresholds?: Record<string, number>,   // e.g. {"t1": 10, "t2": 25} for stat/gauge
  state?: "normal" | "attention" | "critical" | "stale",  // default "normal"
  pinned?: boolean
}
```

### Presets

Every schema-defined preset below renders in the display client. Invalid data
is contained to that widget and shown as a quiet error state instead of
crashing the dashboard.

| Preset | Renders? | `data` shape |
|---|---|---|
| `clock` | ✅ | `{}` — no data needed |
| `stat` | ✅ | `{label, value, unit?, delta?, spark?: number[]}` |
| `gauge` | ✅ | `{label, value, min, max, warn?, crit?, unit?}` |
| `timeseries` | ✅ | `{label, series: [{t: number, v: number}], window?: string, unit?: string}` |
| `statusGrid` | ✅ | `{items: [{id, label, state: "up"\|"down"\|"degraded", latency?}]}` |
| `list` | ✅ | `{items: [{id, label, value: string\|number}]}` |
| `headline` | ✅ | `{text, kicker?, tone?: "neutral"\|"positive"\|"negative"}` — use this as the narrator, e.g. "All systems nominal" |
| `barChart` | ✅ | `{label, categories: [{label, value}]}` |
| `donut` | ✅ | `{label, segments: [{label, value}]}` (max 5) |
| `table` | ✅ | `{columns: [{key, label, type}], rows: object[]}` |
| `ticker` | ✅ | `{lines: [{t, text, level?}]}` |
| `agenda` | ✅ | `{events: [{id, title, startsAt, endsAt}]}` |
| `text` | ✅ | `{md: string}` |
| `nowPlaying` | ✅ | `{title, artist, artUrl?, progress: 0-1, state: "playing"\|"paused"}` |
| `weather` | ✅ | `{tempC, condition, hi, lo, hourly?}` |
| `image` | ✅ | `{src, alt?, fit?, kenBurns?}` |
| `video` | ✅ | `{src, poster, loop?}` — video at tier 3, poster fallback below |
| `composite` | ✅ | `{archetype, slots, data}` — data is validated against the selected archetype |

## Moments — how the display "notices" data

You almost never need `triggerMoment` — pushing data to `stat`, `gauge`,
`timeseries`, or `statusGrid` widgets auto-evaluates a severity tier and the
display animates accordingly:

- **stat**: `|Δ value|` ≥ `thresholds.t1` (default 10%) → notice pulse; ≥
  `thresholds.t2` (default 25%) → event (background ripple).
- **gauge**: crossing `warn` → event; crossing `crit` → alert (widget
  promoted, screen edges bleed red, everything else dims). Same % deltas as
  stat also apply.
- **timeseries**: a new point ≥3σ off the recent window → event; same %
  delta rule otherwise.
- **statusGrid**: any item flips to `"down"` → alert; recovering → event.

So to make a container-death demo, just push
`{"items":[{"id":"db","label":"db","state":"down"}]}` (merged into existing
items by id upstream — send the full `items` array, it replaces, not
merges per-item) to a `statusGrid` widget; you don't need `triggerMoment` at
all. Use `triggerMoment` only when you want to force a tier without an
underlying data change.

## Themes

`setTheme` with `{"theme": {"preset": "<id>"}}`. Built-in presets today:
`observatory` (default), `kanso`, `noir`, `meadow`, `borealis`, `dunes`. You
can also pass a full token object matching `ThemeTokens` (see
[packages/core/src/schema/theme.ts](packages/core/src/schema/theme.ts)) to
compose a fully custom theme — there is no `set_vibe`/free-text-to-theme
endpoint yet (planned, not implemented).

## Scene document (for `setScene` / initial `scene` on create)

```ts
{
  version: number,
  name: string,
  theme: {preset: string} | ThemeTokens,
  mood: "ambient" | "focus" | "alert" | "sleep",
  narrative: {
    anchors?: string[],
    acts: [{hero?: string, supporting: string[] (max 4), ambient: string[], dwellSec?: number}],
    rotation: {mode: "off"|"auto"|"story", dwellSec: number, indicator: "none"|"hairline"}
  },
  widgets: Widget[]
}
```

## Live updates (read-only, for building your own viewer)

`GET /v1/dashboards/:slug/live` upgrades to a WebSocket. On connect you get
one `{"type":"sync","rev":n,"scene":{...}}` frame with the full document,
then `{"type":"ops","from":n,"to":m,"ops":[...]}` frames as things change.
If `from` doesn't match your last known rev, send `{"type":"resync"}` and
wait for a fresh `sync`. Agents pushing data don't need this — it's for
building an alternate display client.

## Practical guidance for an agent driving this

1. One `hero`, up to four `supporting` — don't overload a scene. If you have
   more to show, use acts (`setActs` + `setRotation({mode: "story"})`)
   instead of cramming everything into `ambient`.
2. Use `headline` widgets to narrate state changes in plain language ("DB
   restarted, all clear") rather than relying on the viewer to infer it from
   numbers.
3. Prefer the `widgets/:wid/data` one-liner for routine metric pushes; batch
   `ops` calls when you're restructuring layout or theme, since ops apply
   atomically and each is one op-log entry.
4. Don't fight the layout: there are no coordinates to set. If something
   should be more prominent, promote it to `hero` or trigger a `t3`, don't
   try to reposition anything (`pinWidget` is the only manual override, and
   should be rare).
