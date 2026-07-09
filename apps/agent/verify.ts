// Temporary offline verification (not in src/, not typechecked/shipped).
// Run: node --import tsx /Users/petars/projects/personal/nocturne/apps/agent/verify.ts
import assert from "node:assert/strict";
import { wcagContrast } from "culori";
import { opsBatchSchema } from "@nocturne/core";
import { themePresets } from "@nocturne/core/themes";
import { loadConfig, parseIntervalMs } from "./src/config";
import { clampThemeContrast } from "./src/theme";
import { summarizeScene } from "./src/prompt";
import type { Scene } from "@nocturne/core";

let pass = 0;
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, name);
  pass++;
  console.log(`  ✓ ${name}`);
};

// 1. interval parsing
ok("parse 10m", parseIntervalMs("10m") === 600_000);
ok("parse 90s", parseIntervalMs("90s") === 90_000);
ok("parse 500ms", parseIntervalMs("500ms") === 500);
ok("parse 1h", parseIntervalMs("1h") === 3_600_000);
ok("parse bare number = seconds", parseIntervalMs("45") === 45_000);

// 2. arg/config parsing (isolate from ambient env)
for (const k of Object.keys(process.env)) if (k.startsWith("NOCTURNE_")) delete process.env[k];
const chat = loadConfig([]);
ok("default mode chat", chat.mode === "chat" && chat.dash === "living-room" && chat.model === "claude-sonnet-5");
const tick = loadConfig(["tick", "--once", "--interval", "5m", "-d", "lab", "-m", "claude-opus-4-8"]);
ok("tick flags", tick.mode === "tick" && tick.once && tick.tickIntervalMs === 300_000 && tick.dash === "lab" && tick.model === "claude-opus-4-8");
const once = loadConfig(["make", "it", "noir"]);
ok("one-shot prompt", once.mode === "once" && once.prompt === "make it noir");
ok("dry-run + yes flags", loadConfig(["--dry-run", "-y"]).dryRun && loadConfig(["-y"]).yes);

// 3. ops validation (apply_ops self-correction path)
const goodOps = [
  { type: "addWidget", widget: { id: "cpu", type: "stat", data: { label: "CPU", value: 42, unit: "%" } } },
  {
    type: "setNarrative",
    narrative: {
      anchors: ["clock"],
      acts: [{ hero: "cpu", supporting: [], ambient: ["clock"] }],
      rotation: { mode: "off", dwellSec: 20, indicator: "none" },
    },
  },
  { type: "setMood", mood: "ambient" },
];
ok("valid ops parse", opsBatchSchema.safeParse(goodOps).success);
ok("unknown op rejected", !opsBatchSchema.safeParse([{ type: "teleport", x: 1 }]).success);
ok("malformed widget rejected", !opsBatchSchema.safeParse([{ type: "addWidget", widget: { id: "x" } }]).success);
ok("bad mood rejected", !opsBatchSchema.safeParse([{ type: "setMood", mood: "party" }]).success);

// 4. contrast clamp
const base = themePresets.observatory;
ok("preset already passes AA", wcagContrast(base.palette.text1, base.palette.bg0) >= 4.5);
ok("good theme returned unchanged", clampThemeContrast(base).palette.text1 === base.palette.text1);
const lowContrast = { ...base, palette: { ...base.palette, text1: base.palette.bg0 } };
const fixed = clampThemeContrast(lowContrast);
ok("low-contrast text was adjusted", fixed.palette.text1 !== lowContrast.palette.text1);
ok("clamped text now clears AA", wcagContrast(fixed.palette.text1, base.palette.bg0) >= 4.5);

// 5. scene summary
const scene: Scene = {
  version: 1,
  name: "homelab",
  theme: { preset: "noir" },
  mood: "ambient",
  narrative: {
    anchors: ["clock"],
    acts: [{ hero: "cpu", supporting: ["mem"], ambient: ["clock"] }],
    rotation: { mode: "off", dwellSec: 20, indicator: "none" },
  },
  widgets: [
    { id: "clock", type: "clock", data: {}, state: "normal" },
    { id: "cpu", type: "stat", data: { label: "CPU", value: 42 }, state: "normal" },
    { id: "mem", type: "gauge", data: { label: "Mem", value: 60, min: 0, max: 100 }, state: "normal" },
  ],
};
const summary = summarizeScene(scene, 7);
ok("summary mentions widgets + hero + theme", summary.includes("cpu(stat)") && summary.includes("hero:cpu") && summary.includes('preset "noir"') && summary.includes("rev 7"));

console.log(`\n${pass} checks passed.`);
