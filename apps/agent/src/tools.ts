// The agent's tools — a tight set mirroring the planned MCP surface (§9.4).
// apply_ops validates against the shared @nocturne/core schema before sending,
// so the model self-corrects on bad ops instead of hitting a server 400.

import { tool } from "ai";
import { z } from "zod";
import { opsBatchSchema, themeTokensSchema, type Op } from "@nocturne/core";
import type { NocturneClient } from "./client";
import type { Config } from "./config";
import { summarizeScene } from "./prompt";
import { clampThemeContrast } from "./theme";

const DESTRUCTIVE = new Set(["removeWidget", "setScene", "saveScene", "loadScene"]);

export function isDestructive(op: { type?: string }): boolean {
  return DESTRUCTIVE.has(op?.type ?? "");
}

/** Clamp text/background contrast on any setTheme op that carries full tokens. */
function clampSetTheme(op: Op): Op {
  if (op.type === "setTheme" && !("preset" in op.theme)) {
    return { ...op, theme: clampThemeContrast(op.theme) };
  }
  return op;
}

export function createTools(client: NocturneClient, cfg: Config) {
  const get_scene = tool({
    description:
      "Read the current scene document for this dashboard. Call before mutating so you know widget ids, roles, theme, and mood.",
    inputSchema: z.object({}),
    execute: async () => {
      const { scene, rev } = await client.getScene(cfg.dash);
      return { rev, summary: summarizeScene(scene, rev), scene };
    },
  });

  const apply_ops = tool({
    description:
      "Apply a batch of Nocturne ops (see the ops reference in your instructions). Ops apply in order, atomically. Validated locally before sending; on an invalid_ops result, read `issues`, fix the ops, and retry.",
    inputSchema: z.object({
      ops: z
        .array(z.unknown())
        .describe("Array of op objects, e.g. [{type:'addWidget',widget:{…}},{type:'setNarrative',narrative:{…}}]."),
    }),
    execute: async ({ ops }) => {
      const parsed = opsBatchSchema.safeParse(ops);
      if (!parsed.success) {
        return { ok: false as const, error: "invalid_ops", issues: parsed.error.issues.slice(0, 20) };
      }
      const batch = parsed.data.map(clampSetTheme);
      if (cfg.mode === "tick") {
        const blocked = batch.filter(isDestructive).map((o) => o.type);
        if (blocked.length > 0) {
          return {
            ok: false as const,
            error: "blocked_in_autonomous_mode",
            blocked,
            hint: "Autonomous ticks may only add/update widgets, set narrative/theme/mood, trigger moments, and push data.",
          };
        }
      }
      if (cfg.dryRun) return { ok: true as const, dryRun: true, applied: batch };
      const { rev } = await client.applyOps(cfg.dash, batch);
      const after = await client.getScene(cfg.dash);
      return { ok: true as const, rev, summary: summarizeScene(after.scene, after.rev) };
    },
  });

  const push_data = tool({
    description:
      "Push data to one widget (shorthand for a pushData op). Shallow-merges into the widget's data — send only what changed. Use for routine metric updates.",
    inputSchema: z.object({
      widgetId: z.string(),
      data: z.record(z.string(), z.unknown()).describe("Partial data object, e.g. {value: 73}."),
    }),
    execute: async ({ widgetId, data }) => {
      if (cfg.dryRun) return { ok: true as const, dryRun: true, widgetId, data };
      const { rev } = await client.pushData(cfg.dash, widgetId, data);
      return { ok: true as const, rev };
    },
  });

  const set_vibe = tool({
    description:
      "Apply a fully custom theme for a free-text vibe (e.g. 'rainy Tokyo night'). Provide a COMPLETE ThemeTokens object; text/background contrast is clamped for you before it's applied. Prefer apply_ops setTheme {preset} when a built-in preset (observatory, kanso, noir, meadow, borealis, dunes, grass) already fits.",
    inputSchema: themeTokensSchema,
    execute: async (tokens) => {
      const theme = clampThemeContrast(tokens);
      if (cfg.dryRun) return { ok: true as const, dryRun: true, theme };
      const ops: Op[] = [{ type: "setTheme", theme }];
      const { rev } = await client.applyOps(cfg.dash, ops);
      return { ok: true as const, rev, themeId: theme.id };
    },
  });

  const list_dashboards = tool({
    description: "List the dashboards available on this server.",
    inputSchema: z.object({}),
    execute: async () => {
      const { dashboards } = await client.listDashboards();
      return { dashboards };
    },
  });

  return { get_scene, apply_ops, push_data, set_vibe, list_dashboards };
}
