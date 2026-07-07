@AGENTS.md

# Nocturne — a living display for AI agents

**PRD v0.2** · Name: Nocturne (settled) · This document is written so that an implementer with zero design taste can build something that looks and moves like it came from a film studio. Where taste is required, this document replaces it with rules and numbers. Deviate from the numbers only with a reason you can say out loud.

---

## 1. Product definition

### 1.1 Thesis

Every dashboard on the market is a *pull* product: a human configures it, it fetches data, it sits still. Nocturne is a *push* surface: **a screen that is itself an API and MCP target — a canvas that AI agents render onto.** Agents are the compositor. The display's only job is to make whatever state it's given look and feel cinematic.

The inversion in one line: *the display is the agent's output device.*

Positioning answer to "why isn't this just an HTML file Claude generates?": a generated file is dead on arrival — no live data, no persistence, no quality floor. Nocturne is a persistent, stateful surface with a live data plane and a guaranteed aesthetic ceiling.

### 1.2 Audience

Seed audience: home lab and self-hosting enthusiasts (r/homelab, r/selfhosted). They already talk to their labs through MCP; nobody has given their agents a screen to draw on. They evaluate tools by whether a bash one-liner works and whether they can self-host. Both are hard requirements (see §9).

Second ring: prosumer ambient displays (the DAKboard audience) — families, studios, offices.

Explicit non-target for now: B2B digital signage. It shares the renderer but is a different product (fleet provisioning, scheduling, offline resilience, SSO, SLAs). The scene-document architecture keeps that door open at zero cost. We do not walk through it until customers pull us through it.

### 1.3 The demo is the spec

The product is a 90-second video. Every build decision is judged by whether it makes these beats land. These beats are the acceptance test for the MVP (§11).

1. **Idle.** A wall display breathes: slow shader field, a clock, near-silence. It looks like a still from a film.
2. **Summon.** From a phone, the owner tells Claude: "Put my lab on the living room screen." Widgets choreograph in — staggered, sprung, deliberate. The background shifts to make room.
3. **React.** CPU spikes on a host. The gauge's needle springs past the threshold, the value rolls, and a ripple physically travels outward through the background field. The dashboard *noticed*.
4. **Transform.** "Make it feel like cyberpunk noir." In one two-second orchestrated transition, palette, typography, background shader, and motion character all change. No flash, no reload — a morph.
5. **Alert.** A container dies. Red bleeds in at the screen's edges, the status widget grows toward hero position, everything else dims and slows. Attention hierarchy expressed as animation.
6. **Sleep.** "Good night." The scene dissolves to a near-black starfield and the time.

### 1.4 Non-goals (the kill list)

These are decisions, not omissions. Re-litigating them requires a written reason.

- **No coordinates in the agent API.** Agents speak narrative roles (§6); the layout engine owns geometry. LLMs are bad at pixel math and good at stories.
- **No AI-generated arbitrary components.** Beauty comes from constraint. Agents compose from the catalog (§7) and theme via tokens (§3). "AI generates new widget code" is a v3 experiment behind a preview gate, not a feature.
- **No embedded chat agent.** The agent lives where agents live — Claude on a phone, Claude Code, an hourly automation — connected via MCP. Building a second agent inside the display duplicates the architecture's own premise.
- **No Remotion / render-to-video runtime.** Weak devices are handled by effect tiers (§4.7), not by killing liveness. Remotion may return later for shareable marketing clips only.
- **No marketplace, no third-party widget code.** Theme sharing as JSON is cheap, safe, and viral — that ships early. Arbitrary code from strangers on a network-connected display is a security story we refuse to have.
- **No light themes in v1.** This is a dark, ambient, wall-display product. Light mode is a different physics.
- **No per-widget arbitrary CSS.** Global tokens plus a per-widget accent override. The system enforces taste; that is the brand promise.
- **No drag-and-drop editor.** The primary flow is: the AI organizes the dashboard into a story so good the user never wants to move anything. One escape hatch exists — a `pin` op via the control API — because "never" should be earned by quality, not enforced by dogma.
- **No spatial shuffle.** Widgets never change position without a reason (narrative change, act rotation, alert promotion — §6). Spatial memory is the point of a glanceable display; a dashboard that fidgets reads as broken. "Alive" comes from the heartbeat system (§4.6), not from furniture rearranging itself.
- **No Lottie or imported animation in launch themes.** Decor layers (Lottie / video / image) exist as a contained escape hatch for custom themes (§5.1) under strict rules; no launch theme uses them. Imported clip-art clashes with theme palettes and kills the "it always looks cinematic" promise.
- **No fleet management, scheduling, SSO, offline mode.** That's the signage product. Not yet.

---

## 2. Experience principles — the taste section

### 2.1 The display is a living thing

Three layers of motion, always in this hierarchy:

**Ambient (always).** The scene breathes. Background fields drift, widgets idle with sub-perceptual life. The test: you should only *notice the motion when it stops.* Idle motion doubles as OLED burn-in protection (the entire ambient layer drifts ±6px over a 10-minute cycle).

**Reactive (on data).** A data change is an *event with choreography*, scaled to how much it matters (the Moment system, §4.4). Numbers never jump — they roll. Lines never appear — they draw. The dashboard visibly notices things.

**Transformative (on command).** Scene and theme changes are single orchestrated transitions with acts — exit, morph, enter — never a reload or a flash. Widgets present in both the old and new scene *travel* to their new position; they never exit and re-enter.

### 2.2 The signature element

Per-project boldness is spent in exactly one place: **the background is the display's nervous system.** Data events emit physical ripples into the shader field from the widget that caused them; alerts bleed color into the world at the screen's edges; sleep dims the universe. No other dashboard's background *knows what the data is doing*. Everything else in the design stays quiet and disciplined so this one thing can be loud.

### 2.3 Design commandments (numbers replace taste)

1. **The canvas is never pure black.** Backgrounds are tinted darks, L ≈ 4–8%, hue owned by the theme. Pure `#000` is a hole, not a room.
2. **Depth comes from layers, not shadows.** z0 background shader → z1 translucent panel → z2 content → z3 glow accents. Drop shadows are invisible on dark and therefore banned.
3. **Exactly one hero.** If everything glows, nothing glows. Glow (`0 0 48px accent @ 10–12%`) is reserved for the hero widget and attention states.
4. **Two accent colors per theme, maximum.** Data visualization uses accent1 at opacity ramps (100/60/30%), never rainbow palettes. `positive`/`negative` are reserved semantic colors and appear nowhere else.
5. **All numeric values render in the theme's data face with tabular figures. No exceptions.** This one rule guarantees odometer animations align and dashboards look engineered.
6. **Labels are small, uppercase, tracked, and quiet.** 13px, `letter-spacing: 0.08em`, 60% text opacity. The data is the star; labels are stagehands.
7. **20% emptier than feels safe.** Minimum 24px padding inside widgets at 1080p, 16px gutters, 24px outer margin. When a layout feels sparse, it is correct.
8. **Nothing moves linearly.** Springs only (§4.2). Linear easing is the smell of template UI. The single exception is shader time.
9. **Grain is mandatory.** ±3.5% luminance hash noise over every shader background. It is the cheapest trick that separates "cinematic" from "web page gradient," and it kills banding.
10. **Screenshot test.** Any scene, paused at any moment, with fake data, must look like a still from a film UI. If a frame looks bad frozen, the motion is hiding a design failure. Golden-frame screenshots per theme live in CI (§12).

### 2.4 Anti-patterns (what bad looks like)

Rainbow chart palettes. Everything pulsing at once. Typewriter text effects. Cartoon weather icons. 1px solid white borders. Gridline forests on charts. Confetti energy on routine updates. More than one font pairing per theme. Progress bars for things that aren't progressing. A "last updated" timestamp on every widget (staleness is shown by state, §4.5). If a reviewer sees any of these, the build is rejected — no discussion needed.

---

## 3. Design system

### 3.1 Theme tokens

Themes are data. Everything visual derives from this object; the vibe endpoint (§9.3) generates these, presets ship as four instances of it.

```ts
type ThemeTokens = {
  id: string
  palette: {
    bg0: string          // deepest canvas
    bg1: string          // raised dark
    surfaceTint: string  // panel tint, used at 8–14% alpha
    text1: string        // primary text — must hit ≥ 4.5:1 on bg0 (auto-clamped)
    text2: string        // secondary — 60–70% perceptual strength of text1
    accent1: string      // primary accent: data, glows, focus
    accent2: string      // secondary accent: sparingly
    positive: string
    negative: string
  }
  type: {
    display: string      // headings, headline widget
    data: string         // ALL numeric values, tickers, code — monospace
    scaleRatio: number   // 1.4–1.6
  }
  shape: {
    radius: number             // px at 1080p
    border: 'hairline' | 'glow' | 'none'
    blur: boolean              // backdrop blur on panels (tier-gated)
  }
  motion: {
    dialect: 'calm' | 'ink' | 'mechanical' | 'chromatic' | 'terse' | 'gothic'  // §4.3
    speed: number              // 0.5–1.5 multiplier on all durations
  }
  background: {
    engine: 'aurora' | 'gridHorizon' | 'particles' | 'phosphor' | 'growth' | 'deepField' | 'flat'  // §5
    preset?: string            // e.g. particles:'starfield' | 'petals' | 'embers'
    params?: Record<string, number | string>
    decor?: DecorLayer[]       // §5.1 — optional, tier-gated, unused by launch themes
  }
  density: 'airy' | 'normal'
}
```

### 3.2 The six launch themes

A theme is a complete fantasy: tokens + a background engine preset (§5) + a motion dialect (§4.3) + exactly one signature detail. A theme missing any layer is a color swap and does not ship. Six launch themes were chosen so that five engines cover all of them; the long tail of themes is post-launch content — and the paid theme-pack inventory — not launch scope.

**Observatory** (default) — deep-space instrument panel. `bg0 #0A0E1A · bg1 #101627 · surfaceTint #8FA8C7 · text1 #E8EDF7 · text2 #93A0B8 · accent1 #5EEAD4 · accent2 #818CF8 · pos #4ADE80 · neg #F87171`. Display: Sora · Data: Spline Sans Mono. Shape: radius 20, hairline, blur on. Dialect: `calm`. Background: `aurora` (teal-indigo). Signature: 2–4px parallax between widget layers. As the default it must never read as a template: no terracotta, no acid-green-on-black, no broadsheet hairline grid.

**Kanso** — sumi ink and washi paper at night; the taste flagship. `bg0 #0D0E10 · bg1 #16171A · surfaceTint #B8AFA4 · text1 #F0EBE2 · text2 #9A938A · accent1 #E8697D (sakura) · accent2 #8FA88F (pine) · pos #A3C9A8 · neg #D9564F (vermillion)`. Display: Shippori Mincho · Data: M PLUS 1 Code. Shape: radius 4 (shoji rectilinearity), hairline, **blur off — paper is matte**. Dialect: `ink`. Background: `growth` + `particles:petals` (§5.6). Signature: the branch lives on local time — it grows through the morning, blooms by day, sheds at dusk, stands bare under a moon at night.

**Noir** — Blade Runner street level. `bg0 #0B0A12 · bg1 #14121F · surfaceTint #9D8FC7 · text1 #EDEAF5 · text2 #8E87A3 · accent1 #22D3EE · accent2 #F0ABFC · pos #34D399 · neg #FB7185`. Display: Chakra Petch · Data: IBM Plex Mono. Shape: radius 8, glow borders, blur on. Dialect: `mechanical`. Background: `gridHorizon` (no sun, heavy fog). Signature: a single-line scan glitch on the hero, at most once per two minutes.

**Synthwave** — 1986 sunset that never ends. `bg0 #0F0A1E · bg1 #1A1230 · surfaceTint #B48EDB · text1 #F2ECFF · text2 #9D8FC0 · accent1 #FF3FA4 · accent2 #23D5FF · pos #4ADE80 · neg #FF5C7A`. Display: Archivo (expanded, 600) · Data: Space Mono. Shape: radius 6, glow borders, blur on. Dialect: `chromatic`. Background: `gridHorizon` preset `sunset` (striped sun on the horizon — engine param, not a token). Signature: chromatic-aberration pulse on tier-2 moments.

**Terminal** — phosphor CRT. `bg0 #050705 · bg1 #0A0F0A · surfaceTint #3DF07E @6% only · text1 #D7FFE4 · text2 #6FAF8A · accent1 #3DF07E (single accent) · pos #3DF07E · neg #FF5C5C`. Display and data: Fragment Mono (mono everything is the point). Shape: radius 2, hairline, blur off. Dialect: `terse`. Background: `phosphor`. Signature: block-cursor blink on the hero value. This is deliberately a genre homage — the one place the retro cliché is correct for this audience — and it earns it through discipline: one accent, one face, radius 2.

**Requiem** — candlelit gothic. `bg0 #0E0A0F · bg1 #171019 · surfaceTint #A8899A · text1 #EFE6E9 · text2 #9B8C93 · accent1 #D64C5E (crimson) · accent2 #8B7BB8 (amethyst) · pos #A3BE8C · neg #E8564A`. Display: Cormorant Garamond · Data: JetBrains Mono. Shape: radius 10, glow (candle halo), blur on. Dialect: `gothic`. Background: `aurora` preset `smoke` (desaturated, very slow) + `particles:motes`. Signature: global candlelight — a 0.5–1% luminance flicker at low frequency, felt rather than seen.

All faces are on Google Fonts; self-host the woff2 files — a wall display must not depend on a fonts CDN.

**Roadmap packs (post-launch, this is the paid inventory):** Ember (warm analog dusk — tokens already drafted), Bridge (spaceship HUD — starfield + deepField), Nebula (deepField + aurora layered), Orrery (steampunk — requires a new brass/mechanical linkage engine), Biomech (alien — requires a new organic membrane shader), Solarpunk (requires light mode, v2 physics). Orrery and Biomech are the expensive ones — each needs a bespoke engine — which is exactly why they are packs and not launch scope.

### 3.3 Typography scale (design resolution 1080p, scale = viewportHeight / 1080, clamped 0.6–2.0)

| Role | Size | Face | Treatment |
|---|---|---|---|
| label | 13 | data | UPPERCASE, tracking 0.08em, text2 @ 60% |
| meta / units | 14 | data | text2 |
| body | 16 | display | text1 |
| value-s / value-m / value-l | 28 / 44 / 76 | data | tabular, text1 |
| value-hero (clock, hero stat) | 132 | data | tabular, weight 300–400, tracking −0.02em |
| headline widget | 56 | display | weight 500, max 2 lines |

### 3.4 Surface recipe (the panel)

Every widget sits on exactly this surface. Do not improvise.

```
background:        rgba(surfaceTint, 0.10)          // 0.08 airy · 0.14 dense
border:            1px solid rgba(255,255,255,0.06) // 'glow': + 0 0 24px rgba(accent1,0.08)
inner highlight:   inset 0 1px 0 rgba(255,255,255,0.05)
backdrop-filter:   blur(24px) saturate(120%)        // effect tier ≥ 2 only
tier-1 fallback:   opaque mix(bg1 85%, surfaceTint 15%), no blur
radius:            theme.shape.radius
hero only:         box-shadow: 0 0 48px rgba(accent1, 0.10)
```

---

## 4. Motion system

Motion is a language with fixed grammar (verbs, tiers, timing) and per-theme accent (dialects). Dialects change how a verb is costumed, never what it means. This is the containment strategy: verbs are implemented once per *primitive* (§7.1), dialects are configuration plus exactly one bespoke effect each — so variety multiplies without implementation exploding.

### 4.1 The five verbs

Every primitive implements: **enter** (arrival), **exit** (departure), **update** (data changed), **idle** (alive at rest), **alert** (sustained attention state). Widgets do not own animations; they choreograph their primitives' verbs with a stagger (60ms × primitive order). Numbers never jump — they roll. Lines never appear — they draw. Charts never repaint — they morph.

### 4.2 Timing and physics

| Event | Duration | Notes |
|---|---|---|
| micro feedback | 180ms | chip flashes, dot flips |
| standard update | 550ms | value rolls, arc sweeps |
| widget enter | 600ms spring | stagger 60ms per widget, per primitive |
| widget exit | 250ms | fade + scale 0.96 |
| scene / theme morph | 1600ms, 3 overlapping acts | exit 500 → background morph 400 → enter 700 |
| moment t1 / t2 / t3 onset | 400 / 900 / 1200ms | §4.4 |
| idle cycle | 4–8s | amplitude ≤ 2px translate, ≤ 3% opacity, ≤ 1.01 scale; phases desynced per widget via id-hash |

Springs only; linear easing is banned except shader time. All durations multiply by `theme.motion.speed`. Idle motion must pass the test in §2.1: noticeable only when it stops.

### 4.3 Dialects

| Dialect | Springs (stiffness, damping) | Enter | Update flavor | Scene transition | Signature effect (the only bespoke code allowed) |
|---|---|---|---|---|---|
| `calm` | 120, 20 | rise 24px + fade + blur-out | smooth roll | crossfade + drift | soft layer parallax 2–4px |
| `ink` | 80, 16 | ink-bleed mask reveal (radial soft mask) | value fades through gray, like a brush lifting | wash sweep (soft gradient wipe) | ink-bleed reveals |
| `mechanical` | 300, 30 (hard settle) | clip-reveal from edge | digit flicker-settle | shutter slices | single-line scan glitch, hero only, ≥ 120s apart |
| `chromatic` | 260, 22 | pop from scale 0.9 with 60ms RGB split that resolves | neon flash trail | horizon sweep | chromatic-aberration pulse on t2 |
| `terse` | stepped 120–180ms, no overshoot | block-cursor sweep reveal | character flip | CRT power blink (subtle) | cursor blink on hero value |
| `gothic` | 100, 18 | rise from below, candle-flicker opacity settle | value smolders (brief warm glow) | dissolve like smoke | global 0.5–1% luminance flicker |

Implementation: a dialect is a config object consumed by primitive verb implementations, plus one registered effect. Adding a dialect never requires touching a widget.

### 4.4 Moments — data changes as choreography

A moment is an event with a severity tier. Sources: threshold crossings and deltas evaluated by widget defaults, or an explicit `triggerMoment` op.

- **t0 — silent.** Value morphs. Nothing else.
- **t1 — notice** (400ms). Primitive pulse + accent flash on the affected element.
- **t2 — event** (900ms). Widget scale-bumps to 1.02, its update verb plays emphasized, and it emits a physical ripple into the background: renderer computes the widget centroid in NDC and pushes it into the engine's pulse buffer (§5.1). The dashboard visibly notices.
- **t3 — alert** (sustained, 1200ms onset). Widget state → `critical`: it is promoted toward hero position (a motivated layout change), `negative` color bleeds in at the screen edges via the engine's vignette, all other widgets dim to 70% and their idle slows. Persists until the condition clears or an op resets it; recovery plays a t2 with `positive` accent.

Default triggers: stat |Δ| ≥ 10% → t1, ≥ 25% → t2. Gauge crossing `warn` → t2, crossing `crit` → t3. StatusGrid: any item down → t3, recovery → positive t2. Timeseries: rolling z-score ≥ 3 → t2. All overridable per widget.

**Coalescing bus (the anti-seizure system).** Minimum 400ms between t1s. One active t2 globally; queued t2s within 5s merge (max queue 3, drop oldest). t3 is exclusive: while active, lower tiers are suppressed and counted as a small badge on their widgets. Global 5s cooldown after any t2. A dashboard having a bad day must look *urgent*, never *epileptic*.

### 4.5 Moods and staleness

Moods are scene-level states: `ambient` (default), `focus` (hero emphasized, supporting dimmed 80%, ambient rail at 50%), `alert` (entered automatically by t3), `sleep` (starfield preset tinted by theme, uDim 0.85, clock as sole hero, everything else exits).

Staleness: every data binding has a freshness TTL (default 60s). At 2×TTL the widget desaturates to 60% and shows a quiet `stale · 4m` chip. No "last updated" timestamps anywhere else — state communicates freshness, not clutter.

### 4.6 Heartbeat — alive when nothing happens

A global scheduler fires every 2–5 minutes (Poisson-spaced). It performs exactly one act of spontaneous life, chosen from: hero glow swell (3s), one widget's sparkline replays its draw, a low-strength background pulse from screen center, or the dialect's signature flourish (a petal falls, the cursor stretches a blink, an ember rises). Never two at once; suppressed in `alert` and `sleep` moods and for 60s after any t2+. This — not spatial fidgeting — is how the display feels like a sleeping animal rather than a screensaver.

### 4.7 Effect tiers and reduced motion

Tier 3: full — shader at full resolution, backdrop blur, video widgets, deepField engine. Tier 2: shader at half resolution upscaled, blur off (opaque panel fallback §3.4), particle counts halved, video off (poster shown). Tier 1: `flat` engine (slow two-stop gradient hue drift), no blur, simplified springs — still springs. Auto-detected by sampling rAF FPS for 10s at boot, manually overridable, persisted per screen. `prefers-reduced-motion` forces: idle off, heartbeat off, all transitions become 200ms fades, moments become color-only. Perf budgets: one WebGL context total; animate only `transform` and `opacity` in DOM; charts on canvas, ≤ 300 visible points; 60fps target on a dev laptop, ≥ 45fps on Raspberry Pi 5 at tier 2.

---

## 5. Background engines

### 5.1 The contract

Backgrounds are engines, not effects. Every engine implements one interface so the moment system, moods, and themes work identically everywhere:

```ts
interface BackgroundEngine {
  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: Params): void
  tick(t: number): void
  pulse(originNdc: [number, number], strength: number): void   // moment ripples, ≤4 concurrent
  setVignette(v: number, color: string): void                  // alert bleed at edges
  dim(v: number): void                                         // focus / sleep
  setMood(mood: Mood): void
  setParams(p: Params): void; resize(): void; dispose(): void
  minTier: 1 | 2 | 3
}
```

Universal rules: ±3.5% luminance hash grain on every shader engine (§2.3 rule 9); the whole ambient layer drifts ±6px over a 10-minute cycle (burn-in guard); WebGL context-loss handler that restores or degrades to `flat`; every theme automatically maps to `flat` with its own palette at tier 1.

**Decor layers** (the Lottie escape hatch): `{ type: 'lottie' | 'image' | 'video', src, placement, opacity ≤ 0.5, tint? }`, rendered above the engine, below panels. Rules: loopable and ambient only, tier ≥ 2, must pass the screenshot test in all four moods, tinted toward the theme palette where the format allows. No launch theme uses one. They exist so custom themes can, under supervision.

### 5.2 `aurora` — flowing gradient field (Observatory, Requiem:smoke)

Full-screen triangle, single-pass fragment shader, 4-octave value-noise fbm with domain warping. Core:

```glsl
vec2 p = uv * 1.5; float t = uTime * uSpeed;                 // uSpeed ~ 0.02
float n = fbm(p + fbm(p + vec2(t*0.06, -t*0.04)));           // domain warp
vec3 col = mix(uColorBg, uColorA, smoothstep(0.35, 0.75, n));
col = mix(col, uColorB, smoothstep(0.55, 0.95, fbm(p*1.7 - t*0.03)));
col += pulses(uv);                                            // radial waves from uPulse[4]
col = mix(col, col * uVignetteColor, uVignette * edgeMask(uv));
col += (hash(uv * uRes + t) - 0.5) * 0.035;                  // mandatory grain
```

Pulse wave: `d = length(uv - o); w = sin(d*20.0 - age*6.0) * exp(-d*4.0 - age*2.0) * strength;` added to the warp domain, so ripples bend the field rather than drawing rings on it. Presets: `observatory` (teal-indigo), `smoke` (Requiem — desaturated, uSpeed 0.5×, contrast lowered).

### 5.3 `gridHorizon` — perspective floor (Noir, Synthwave)

Procedural: transform `guv = vec2(uv.x - 0.5, 1.0 / (uv.y + 0.05))`, glowing lines via smoothstep on `fract(guv * density + vec2(0, t))`, exponential fog toward the horizon, sparse hash stars above it. Preset `sunset` (Synthwave) adds the striped sun disc: a circle at the horizon with `step(sin(y * stripes), cut)` bands, colors passed as engine params. Pulses brighten the grid lines radially; vignette tints the fog.

### 5.4 `particles` — one instanced system, many worlds

One engine (three.js InstancedMesh; procedural sprites: circle, spark, petal path), parametrized by spawn region or emitter points, wind vector, gravity, rotation behavior, count, palette. Presets: `starfield` (900 points, 3 parallax layers, per-particle twinkle phase, 2px/min drift — also the universal `sleep` background, tinted by theme), `petals` (≤120, flutter via per-particle sinusoidal phase + gravity drift + rotation; spawns from `growth` emitter points when paired), `embers` (rise, warm fade), `motes` (Requiem — slow candlelit float). Pulses apply a radial impulse to nearby particles; this looks *incredible* and costs nothing.

### 5.5 `phosphor` — CRT field (Terminal)

Cheapest engine: scanlines, corner vignette, grain, and a rare flicker (≤120ms, ≥90s apart). Restraint is the feature; if a reviewer consciously notices the scanlines from across the room, halve their opacity.

### 5.6 `growth` — the Kanso branch (the one bespoke splurge)

A cherry branch that lives on the display's local time. Implementation: a hand-authored base skeleton (3–4 cubic béziers per variant, authored once — taste-safe) plus procedural twigs (recursive midpoint offshoots, depth 3, angle jitter 20–35°, length decay 0.62). Rendered as stroked paths with round caps and slight width noise (brush feel). Growth = stroke-dashoffset draw-on. Buds appear at terminal nodes and bloom into petal emitters (feeds §5.4 `petals`).

Lifecycle by local time: dawn — growth spurts; day — full bloom, occasional single petal falls (heartbeat integration); dusk — heavy fall; night — bare branch, moon disc, petals replaced by sparse `motes`. Moment mapping: positive t2 → a petal burst; alert t3 → a shiver runs through the branch (rotational sway from the trunk origin). Budgets: ≤400 path segments, ≤120 petals. **Timebox: one weekend.** If it isn't beautiful by Sunday night, Kanso ships with petals-only and the branch moves to the roadmap — this engine is the project's highest rabbit-hole risk (§12).

### 5.7 `deepField` — 3D star volume (tier 3 only; Bridge/Nebula packs, optional Observatory upgrade)

react-three-fiber, 3–5k instanced stars in a volume, camera on a slow Lissajous drift with parallax. The "3D map of stars." Ships only if tier-3 hardware is detected; never blocks launch.

---

## 6. Layout engine — the AI writes the story, the system does the typesetting

### 6.1 Narrative roles, never coordinates

Agents place nothing. They declare narrative: at most one **hero**, up to four **supporting**, the rest **ambient**. The layout engine deterministically resolves roles into geometry — same document, same layout, always — so agents can reason about outcomes. This is what makes "the AI organizes the dashboard so well you never move anything" achievable instead of aspirational: LLMs are good at stories and bad at pixel math, so the API accepts stories and forbids pixels.

### 6.2 Grid resolution

Canvas = 100vw × 100vh. Landscape: 12 columns × 6 rows; portrait: 6 × 12. Outer margin 24px, gutters 16px (at 1080p, scaled per §3.3). Hero: 6–8 cols × 4 rows (position varies by supporting count: left-anchored with 3–4 supporting, centered with ≤2). Supporting: 4×2 or 4×3 cells, packed left-to-right, top-to-bottom into remaining space. Ambient: a 1-row strip along the bottom (landscape) or a right rail. No hero → first supporting promotes to a 6×3 featured slot. Capacity per act: 9 widgets landscape (1+4+4), 6 portrait. Packing order is stable (role, then insertion order) so layouts don't churn.

### 6.3 Acts — story chapters and overflow rotation

When there are more widgets than one screen holds — or when the agent wants a narrative sequence — the scene has **acts**:

```ts
narrative: {
  anchors?: WidgetId[]     // persist across every act: the clock, an alert rail
  acts: Array<{ hero?: WidgetId, supporting: WidgetId[], ambient: WidgetId[], dwellSec?: number }>
  rotation: { mode: 'off' | 'auto' | 'story', dwellSec: number /* default 20, min 10 */,
              indicator: 'none' | 'hairline' }
}
```

`auto`: the engine packs whatever fits and spills the rest into generated acts. `story`: the agent authors acts explicitly ("Act 1: infrastructure. Act 2: media and home."). Act transitions use the full scene-morph choreography; anchors and widgets shared between acts *travel* to their new slots — continuity is what makes rotation feel like chapters instead of pagination. The optional indicator is a 2px hairline at the bottom edge filling over the dwell at 20% opacity — nothing louder. Moments interact with rotation: a t3 forces and pins the affected widget's act until cleared; a t2 on an off-screen widget queues and pulses the indicator once.

### 6.4 Position is sacred

Within an act, positions are a pure function of (narrative, orientation, capacity). They change only for motivated reasons: a narrative op, an act transition, or an alert promotion. Idle motion never translates a widget more than 2px. `pinWidget` exists as the single manual escape hatch. There is no random repositioning, ever — see the kill list.

### 6.5 Continuity rules

All layout changes animate via FLIP with the theme's springs. A widget present before and after any transition must travel, resize, and re-theme in place — exit-and-reenter of a surviving widget is a bug by definition. Theme morphs interpolate tokens (colors in OKLCH, radius and type scale numerically) while the background engine cross-fades or hands off with a 400ms overlap.

---

## 7. Widget system — primitives × archetypes × presets

The abstraction that answers "text, images, video, big numbers, charts, tables, complex compositions, all reacting uniquely": widgets are not components. A widget is a **preset**: an archetype (slot template) filled with **primitives** (content atoms). Primitives implement the five verbs once; dialects costume them per theme. Perceived variety = primitives × verbs × dialects, three small sets that multiply. Implementation cost lives in the primitives and archetypes; presets are configuration.

### 7.1 Content primitives (13)

| Primitive | Renders | Update verb | Idle verb |
|---|---|---|---|
| `value` | number, odometer digits, tabular | roll to new value | none (digits never fidget) |
| `label` / `unit` | §3.3 label / meta styles | crossfade | none |
| `delta` | signed chip, positive/negative colored | flip + flash | none |
| `spark` | 60-point micro line | extends with tip pulse | rare replay (heartbeat only) |
| `chart` | line, area, bar, donut (canvas) | morph between datasets, draw-in new points | breathing gradient fill ±3% |
| `arc` | gauge sweep with glowing tip | spring sweep with overshoot, zone ticks at warn/crit | tip glow breathes |
| `glyph` | curated outline icon set, stroke-drawn | stroke redraw | none |
| `text` | 1–4 lines, display face, bold/em only | masked word-stagger rise (never typewriter) | none |
| `media` | image or video fill | crossfade | Ken Burns pan/zoom, 40s cycle |
| `progress` | thin bar or ring | sweep | none |
| `dot` | status point: up/down/degraded | scaleX flip + ripple emit | slow pulse when degraded |
| `rows` | table/list row engine | FLIP reorder, value rolls per cell | none |
| `stream` | ticker line engine | new line slides up, old fade to 40% | none |

### 7.2 Archetypes (8 slot templates)

`heroValue` (giant value + label + optional delta/spark), `statRow` (glyph + value + label — the "icon+number+text" composition), `chartCard` (label + chart + optional current-value), `matrix` (grid of dots/cells), `tableCard` (typed columns + rows), `streamCard` (label + stream), `textCard` (kicker + text), `mediaCard` / `splitCard` (media, or media beside content). Each archetype defines slot positions per widget size (hero / supporting / ambient) — a `stat` in the ambient rail is just value+label; as hero it gains the spark and delta.

### 7.3 Preset catalog v1 (17 — cheap once §7.1–7.2 exist)

`clock` (heroValue; seconds as a thin progress arc, never a ticking number; the sleep hero), `stat` {label, value, unit?, delta?, spark?}, `gauge` {label, value, min, max, warn?, crit?} (arc), `timeseries` {label, series, window?} (chart:area), `barChart` {categories}, `donut` {segments ≤ 5}, `statusGrid` {items: [{id, label, state, latency?}]} (matrix), `table` {columns: [{key, label, type: text|num|delta|status}], rows} (tableCard), `list` {items} (rows; the FLIP-reorder leaderboard), `ticker` {lines: [{t, text, level?}]} (streamCard, mono), `nowPlaying` {title, artist, artUrl?, progress, state} (splitCard; art as 12%-opacity blurred backdrop, progress ring, marquee only on overflow and only one cycle), `weather` {tempC, condition, hi, lo, hourly?} (statRow + spark; condition glyph stroke-drawn — no cartoon icons), `agenda` {events} (live "in 25 min" countdown under 60m), `headline` {text, kicker?, tone?} (textCard — the narrator: agents write the story's captions, "All systems nominal"), `text` {md-lite}, `image` {src, fit, kenBurns?}, `video` {src, poster, muted: true enforced, loop, tier ≥ 3; poster fallback below}.

### 7.4 The `composite` widget — safe agent creativity

`{ type: 'composite', archetype, slots: { slotName: primitiveConfig }, data }` — declarative, Zod-validated composition of primitives. This is the sanctioned answer to "AI generates components": agents assemble from atoms that each carry their own motion and token styling, so the quality floor holds no matter what they build. No code, ever. `describe_capabilities` (§9.4) documents the atoms so agents can discover what's composable.

---

## 8. Scene document and ops

One JSON document per screen is the single source of truth. All mutation flows through semantic ops applied by one pure reducer — the same function runs in the prototype's store, the Durable Object, and the display client.

```ts
type Scene = {
  version: number
  name: string
  theme: ThemeTokens | { preset: string }
  mood: 'ambient' | 'focus' | 'alert' | 'sleep'
  narrative: Narrative                    // §6.3 — anchors, acts, rotation
  widgets: Widget[]
}
type Widget = {
  id: string
  type: PresetType | 'composite'
  title?: string
  data: unknown                            // validated per preset schema
  bind?: { source?: string, ttlSec?: number }   // staleness §4.5
  accent?: 'accent1' | 'accent2'           // the only per-widget style override
  thresholds?: Record<string, number>      // moment triggers §4.4
  state: 'normal' | 'attention' | 'critical' | 'stale'
  pinned?: boolean
}
```

**Control-plane ops** (batchable, LLM-friendly, no coordinates anywhere): `setNarrative`, `setActs`, `setRotation`, `addWidget`, `removeWidget`, `updateWidget`, `pinWidget`, `setTheme`, `setBackground`, `setMood`, `triggerMoment`, `setScene`, `saveScene`, `loadScene`.
**Data-plane op**: `pushData { id, data }` — high-frequency, never through an LLM.

---

## 9. Architecture

### 9.1 Prototype architecture (Phase A — Next.js only)

Next 15 App Router; the display route is fully client-side and static-exportable. Zustand store holding the Scene, mutated only through the pure reducer (schema-first discipline: Zod schemas and the reducer are built in week one, so the store literally becomes the Durable Object later). Motion (framer-motion) for FLIP and springs; three.js/r3f for engines; canvas for charts. No auth, no backend. A dev-only Next route handler (`POST /api/dev/ops`, module-level state) preserves the curl demo even in the prototype. Optional two-window mode via BroadcastChannel (display on the TV, control drawer on the laptop).

### 9.2 MVP architecture (Phase B — Cloudflare + Next)

> **Status (July 2026):** a simplified local-first version of this spine is built — pnpm monorepo (`apps/web`, `apps/server`, `packages/core`), Hono + one SQLite-backed DO per dashboard running the shared reducer, WS live protocol with pushData coalescing, hashed API keys + per-dashboard view codes (no user accounts), run via `wrangler dev` + Cloudflare Tunnel. See README. Deviations from this section: no D1 (DO storage covers it), no auth/better-auth yet, display served by the Next app rather than static-from-worker.

- **API**: Hono on a Cloudflare Worker. **One Durable Object per screen** holds the Scene, applies ops through the same reducer, broadcasts diffs over WebSocket (hibernation makes idle screens ~free). Full-document resync on connect or version mismatch; last 200 ops in DO storage; scenes persisted to D1 (debounced autosave 10s + explicit `saveScene`).
- **Display client**: the same Next app, deployed static (the display route has no server dependency — this deliberately sidesteps OpenNext risk; marketing pages can go wherever).
- **Ingest coalescing**: data-plane pushes accepted at up to 10 rps/screen, coalesced server-side to ≤ 4 broadcast frames/sec.
- **Self-host (hard requirement, §1.2)**: the DO hides behind a `SceneHost` interface with a second in-process implementation (Node + libSQL). One `docker run` serves API + WS + static client. The vibe endpoint takes an `ANTHROPIC_API_KEY` env var or degrades to presets-only. If launch day lacks this container, the seed audience bounces.

### 9.3 Security and tokens

Screens pair like TV apps: the display shows a 6-character code, the owner claims it. Auth via better-auth (passkey + magic link), one user owns screens; teams later. Three token types, all revocable, revocation closes WebSockets within 2s: **display** (read + WS), **agent** (ops + read; one per integration), **ingest** (pushData only). Rate limits: ingest per §9.2; ops 60/min. The comforting security story for a paranoid audience: the blast radius of a compromised agent token is pixels — the display renders, it never executes.

### 9.4 Control plane: API and MCP

REST: `POST /v1/screens` · `GET /v1/screens/:id/scene` · `POST /v1/screens/:id/ops` (batch) · `POST /v1/screens/:id/widgets/:wid/data` (the one-liner: `curl -H "Authorization: Bearer $T" -d '{"value":73}' .../widgets/cpu/data`) · `WS /v1/screens/:id/live`.

MCP server, five tools, deliberately few and richly described:
1. `get_scene` — current document.
2. `describe_capabilities` — the keystone for agent usability: presets with schemas and size behavior, primitives and archetypes (for `composite`), themes, engines and params, moods, limits, and composition guidance baked into the description ("a story has one hero; three to five supporting; use `headline` to narrate; put persistent context in `anchors`").
3. `apply_ops` — batch of §8 ops.
4. `push_data` — low-frequency agent pushes (the hourly summary); high-frequency data belongs on REST.
5. `set_vibe` — free text ("make it feel like a rainy Tokyo night") → server-side LLM call with structured output against the ThemeTokens schema → Zod validation → contrast clamp (text1 vs bg0 auto-adjusted to ≥ 4.5:1) → nearest-preset fallback on any failure. Invalid themes are unrepresentable.

---

## 10. Phase A — the prototype (visuals first)

**Purpose**: prove the renderer induces the feeling. If Phase A doesn't make *you* feral, the spine doesn't matter — stop or re-scope. That is a formal go/no-go gate, not a vibe.

**In scope**: scene schema + reducer; layout engine incl. acts and auto-rotation; engines `aurora`, `gridHorizon` (+sunset), `particles` (starfield, petals), `flat`; `growth` as a strictly-timeboxed splurge; dialects `calm`, `mechanical`, `ink`; themes Observatory, Noir, Kanso; primitives value/label/delta/spark/arc/chart(line-area)/dot/rows/text; presets clock, stat, gauge, timeseries, statusGrid, list, headline; moments + coalescing bus; moods; heartbeat; effect tiers with FPS auto-detect. **Out**: everything in §9.2–9.4, media widgets, composite, the other three themes.

**The control drawer** (same page, backtick key; no login): scene presets (Homelab, Minimal, Sleep) · narrative editor (role dropdowns, acts, rotation toggle) · add/remove widgets with fixture data · per-widget data pushers (set value, random-walk toggle, spike button) · moment buttons (t1/t2/t3 on selection) · theme and mood switchers · vibe box stubbed with 4 canned token sets (no LLM yet) · perf overlay (FPS, tier override, reduced-motion sim) · **chaos mode**: random-walks every metric with occasional spikes — the fastest way to *feel* whether the organism is alive.

**Build order**: W1 tokens + surface + aurora + clock/stat on a fixed layout. W2 layout engine + FLIP + acts + gauge/timeseries/statusGrid + enter/exit verbs. W3 moments bus + moods + heartbeat + drawer + chaos + dialects mechanical/ink + Noir/Kanso(petals). W4 growth engine (timeboxed) + device tuning on the actual display hardware + tiers + sleep scene. W5 polish + golden frames + record the teaser video (beats 1, 3, 4, 5, 6 — everything except MCP summoning). The teaser seeds a waitlist.

**Acceptance criteria**:
1. 60fps sustained with a shader engine + 8 widgets on a dev laptop; ≥ 45fps on Pi-5-class hardware at tier 2.
2. Theme morph is one choreographed 1.6s transition — no flash, no unstyled frame, background hand-off included.
3. Adding/removing a widget reflows everything via springs; nothing teleports; surviving widgets travel (§6.5).
4. Ten data pushes/sec on one widget coalesce cleanly; correct moment tiers fire; the anti-seizure bus holds under chaos mode.
5. Act rotation reads as chapters: anchors persist, shared widgets travel, hairline indicator behaves.
6. **Motion Turing test**: given a 5-second grayscale screen capture, a reviewer names the theme from motion alone, 2 of 3 times. If dialects fail this, they're configuration theater — fix before Phase B.
7. Screenshot test: any scene, any theme, frozen at any moment with fixture data, looks like a film still. Golden frames captured per theme.
8. Stale data degrades gracefully (§4.5); `prefers-reduced-motion` fully honored.
9. Kill test: the go/no-go review happens at the end of W5, on the wall, with chaos mode running.

**Timebox: 4–5 weekends.** The fifth exists because of the v0.2 scope expansion; it is the last one that gets absorbed.

## 11. Phase B — the MVP

**In scope**: everything in §9.2–9.4; dialects `chromatic`/`terse`/`gothic` and themes Synthwave/Terminal/Requiem; engines `phosphor` (+ `deepField` if time allows, tier 3 only); presets table/ticker/nowPlaying/weather/agenda/text/image/video; `composite`; theme export/import as JSON (the free sharing loop); the Docker container.

**Acceptance = the demo, executed live, plus operations**:
1. All six beats of §1.3 performed end-to-end from a phone via MCP, recorded as the launch video.
2. Pairing a fresh display takes under 60 seconds; the curl one-liner works on the first copy-paste.
3. `set_vibe` returns a valid, contrast-clamped theme or a preset fallback — 100% of attempts render.
4. An agent builds a sensible `composite` widget using only `describe_capabilities` — no human hints.
5. Token revocation kills the WebSocket within 2 seconds.
6. `docker run` on a clean machine yields a working self-hosted instance in one command.

**Timebox: 4–5 weekends.** Total to launch ≈ 10 weekends. Post-launch, in strict order: theme packs (revenue), hosted relay tier, then whatever the feral thread demands.

## 12. Risks

**Growth-engine rabbit hole** — the highest-charisma, highest-sink item; hard one-weekend timebox, petals-only fallback pre-authorized. **Dialect combinatorics** — contained by verbs-per-primitive plus the one-signature-effect cap; the Motion Turing test catches theater. **Perf on weak devices** — device-in-hand from W4 of Phase A, tiers, FPS in CI alongside golden frames. **LLM misuse of the API** — semantic ops, no coordinates, `describe_capabilities` with composition guidance, server-side validation makes bad states unrepresentable. **WebGL context loss on kiosk devices** — restore handler, `flat` degradation. **Taste drift** — golden frames diffed in CI; the anti-pattern list (§2.4) is a review checklist; end each weekend with the Chanel pass: look at the screen and remove one accessory. **Scope** — this document absorbed one expansion (v0.2); the kill list plus §10/§11 boundaries are now load-bearing, and the default answer to new scope is "theme pack, post-launch."

## 13. Build order and how to feed this document to an agent

Work in vertical slices, never horizontal layers — a widget on a shader with a working morph beats three finished subsystems that have never met. Feed sections to Claude Code in this order, each with its dependencies: (1) §3 + §8 — tokens, schemas, reducer, fixtures for every preset; (2) §5.2 + §3.4 — aurora and the surface recipe, on screen together; (3) §6 + §4.1–4.3 — layout, FLIP, verbs, first dialect; (4) §4.4–4.7 — moments, moods, heartbeat, tiers; (5) §10's drawer and chaos mode; (6) remaining engines and dialects; (7) §9 spine. Maintain `/fixtures` with believable fake data for every preset — the screenshot test depends on it. Golden frames live in the repo from W2 onward. And keep the ritual: every weekend ends with the display on the wall, chaos mode on, one accessory removed.
