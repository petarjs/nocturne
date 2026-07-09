// Temporary live integration check against an isolated server (port 8788).
import assert from "node:assert/strict";
import { NocturneClient, NocturneError } from "./src/client";
import { summarizeScene } from "./src/prompt";

const client = new NocturneClient({ api: "http://localhost:8788" });
const DASH = "living-room";

const key = (await client.bootstrapKey("test-agent")).key;
console.log(`  ✓ bootstrapped key ${key.slice(0, 12)}…`);
assert.match(key, /^noct_[0-9a-f]{64}$/);
client.setKey(key);

await client.createDashboard({ slug: DASH, name: "Living Room" });
console.log(`  ✓ created dashboard "${DASH}"`);

const before = await client.getScene(DASH);
console.log(`  ✓ initial scene rev ${before.rev}`);

// An agent-style batch: add widgets AND place them in a narrative act.
const ops = [
  { type: "addWidget", widget: { id: "clock", type: "clock", data: {}, pinned: true } },
  { type: "addWidget", widget: { id: "cpu", type: "stat", title: "CPU", data: { label: "CPU", value: 42, unit: "%" } } },
  { type: "addWidget", widget: { id: "mem", type: "gauge", title: "Memory", data: { label: "Memory", value: 61, min: 0, max: 100, warn: 80, crit: 92 } } },
  {
    type: "setNarrative",
    narrative: {
      anchors: ["clock"],
      acts: [{ hero: "cpu", supporting: ["mem"], ambient: ["clock"] }],
      rotation: { mode: "off", dwellSec: 20, indicator: "none" },
    },
  },
  { type: "setTheme", theme: { preset: "noir" } },
] as const;

const applied = await client.applyOps(DASH, ops as never);
console.log(`  ✓ applied ${ops.length} ops → rev ${applied.rev}`);

const after = await client.getScene(DASH);
assert.ok(after.scene.widgets.some((w) => w.id === "cpu"), "cpu widget present");
assert.equal(after.scene.narrative.acts[0]?.hero, "cpu", "cpu is hero");
assert.ok("preset" in after.scene.theme && after.scene.theme.preset === "noir", "theme is noir");
console.log("  ✓ widgets present, cpu is hero, theme applied");

const pushed = await client.pushData(DASH, "cpu", { value: 88 });
console.log(`  ✓ pushData cpu=88 → rev ${pushed.rev}`);
const afterPush = await client.getScene(DASH);
assert.equal((afterPush.scene.widgets.find((w) => w.id === "cpu")?.data as { value?: number })?.value, 88);
console.log("  ✓ cpu value merged to 88");

// Server rejects an invalid batch (400) — the tool would catch this locally first.
let rejected = false;
try {
  await client.applyOps(DASH, [{ type: "setMood", mood: "party" }] as never);
} catch (e) {
  rejected = e instanceof NocturneError && e.status === 400;
}
assert.ok(rejected, "server rejects invalid ops with 400");
console.log("  ✓ invalid ops rejected with 400");

console.log(`\nFinal scene:\n${summarizeScene(afterPush.scene, afterPush.rev)}`);
console.log("\nLive integration OK.");
