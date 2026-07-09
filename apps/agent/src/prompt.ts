// System-prompt assembly. The backbone is AGENT_API.md from the repo root — the
// maintainer's own "feed this to an LLM agent" reference — kept as the single
// source of truth. We append operating context + a compact live-scene summary.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Scene } from "@nocturne/core";
import type { Config } from "./config";

let cachedReference: string | null = null;

function loadReference(): string {
  if (cachedReference != null) return cachedReference;
  try {
    const path = fileURLToPath(new URL("../../../AGENT_API.md", import.meta.url));
    cachedReference = readFileSync(path, "utf8");
  } catch {
    cachedReference = FALLBACK_REFERENCE;
  }
  return cachedReference;
}

/** A compact, model-friendly snapshot of the current scene. */
export function summarizeScene(scene: Scene, rev?: number): string {
  const theme = "preset" in scene.theme ? `preset "${scene.theme.preset}"` : `custom "${scene.theme.id}"`;
  const widgets =
    scene.widgets.map((w) => `${w.id}(${w.type}${w.state && w.state !== "normal" ? `,${w.state}` : ""})`).join(", ") ||
    "(none)";
  const acts =
    scene.narrative.acts
      .map(
        (a, i) =>
          `act${i + 1}{hero:${a.hero ?? "-"} supporting:[${a.supporting.join(",")}] ambient:[${a.ambient.join(",")}]}`,
      )
      .join(" ") || "(no acts)";
  const anchors = scene.narrative.anchors?.join(",") || "(none)";
  const rot = scene.narrative.rotation;
  return [
    `Scene "${scene.name}"${rev != null ? ` (rev ${rev})` : ""} — theme ${theme}, mood ${scene.mood}`,
    `widgets: ${widgets}`,
    `narrative: anchors[${anchors}] ${acts} — rotation ${rot.mode}${rot.mode !== "off" ? ` @${rot.dwellSec}s` : ""}`,
  ].join("\n");
}

const CHAT_GUIDANCE = `# Mode: interactive
You are chatting with the display's owner. Be concise. Make the change they asked
for in as few ops as possible, then say briefly what you did (one or two lines).
When a request is vague ("put my lab up", "make it cozy"), compose a sensible,
tasteful scene yourself — don't ask for coordinates or a widget list. Read the
scene first (get_scene) if you're unsure what already exists.`;

const TICK_GUIDANCE = `# Mode: autonomous tick
You are running an unattended check that fires every few minutes. Call get_scene,
look at the data, and act ONLY if something meaningful changed since it would last
have looked different: narrate a real change with a headline widget, react to an
anomaly (a spike, a service down) via mood or a moment, or refresh a stale
headline. If nothing meaningful changed, do NOTHING — apply no ops and reply with
a single short line like "No change." Prefer silence over fidgeting. You may not
remove widgets, replace the scene, or save/load scenes in this mode.`;

export function buildInstructions(cfg: Config, sceneSummary: string): string {
  const reference = loadReference();
  const modeGuidance = cfg.mode === "tick" ? TICK_GUIDANCE : CHAT_GUIDANCE;
  return `${reference}

---

# Operating context

You control the Nocturne dashboard "${cfg.dash}". The live display is at ${cfg.web}/d/${cfg.dash}.
You never see the screen — reason from get_scene and the summary below.

Tools:
- get_scene — read the current document before changing it.
- apply_ops — apply an array of ops (validated locally first; if you get "invalid_ops", read \`issues\` and fix the ops, then retry).
- push_data — shorthand for one pushData to a widget (send only changed fields).
- set_vibe — apply a fully custom theme (complete ThemeTokens) for a free-text vibe; contrast is clamped for you. Prefer apply_ops setTheme {preset:"…"} when a built-in preset fits.
- list_dashboards — list dashboards on this server.

Non-negotiable rules:
- Renderable presets ONLY: clock, stat, gauge, timeseries, statusGrid, list, headline, barChart, donut, table, ticker, agenda, text. Never use nowPlaying, weather, image, video, or composite.
- addWidget alone does NOT show a widget — after adding widgets you MUST reference them in a narrative act (setNarrative/setActs) as hero / supporting / ambient, or they stay invisible.
- At most one hero and four supporting per act; overflow → more acts + rotation. Keep a clock in anchors. Use a headline widget to narrate state in plain language.
- Roles only — never coordinates. Don't fight the layout engine.
- Built-in theme presets: observatory, kanso, noir, meadow, borealis, dunes, grass.

${modeGuidance}

# Current state
${sceneSummary}`;
}

const FALLBACK_REFERENCE = `# Nocturne agent reference (fallback)
Drive a Nocturne display by applying semantic ops to a scene document. Widgets
take narrative roles (hero / supporting / ambient); a layout engine does geometry —
there are no coordinates. Ops include addWidget, removeWidget, updateWidget,
setNarrative, setActs, setRotation, setTheme, setBackground, setMood,
triggerMoment, pushData. See AGENT_API.md in the repo for the full reference.`;
