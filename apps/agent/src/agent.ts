// Builds the ToolLoopAgent. Model resolution is configurable (direct Anthropic
// provider by default, AI Gateway when that's the only credential). In interactive
// chat, destructive ops require a y/n approval in the terminal UI.

import { ToolLoopAgent, isStepCount } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { Config } from "./config";
import { createTools, isDestructive } from "./tools";

function resolveModel(cfg: Config, which: "agent" | "tick") {
  const id = which === "tick" ? cfg.tickModel : cfg.model;
  if (cfg.gateway) return `anthropic/${id}`;
  const anthropic = createAnthropic(cfg.anthropicApiKey ? { apiKey: cfg.anthropicApiKey } : {});
  return anthropic(id);
}

export function createAgent(opts: {
  cfg: Config;
  instructions: string;
  tools: ReturnType<typeof createTools>;
  which: "agent" | "tick";
}) {
  const { cfg, instructions, tools, which } = opts;

  // Approvals only make sense in the interactive TUI (chat). Autonomous ticks and
  // one-shot runs have no interactive approver — destructive ops are blocked in
  // the tool itself (tick) or auto-applied (one-shot).
  const useApprovals = cfg.mode === "chat" && !cfg.yes;

  return new ToolLoopAgent({
    model: resolveModel(cfg, which),
    instructions,
    tools,
    stopWhen: isStepCount(30),
    ...(useApprovals
      ? {
          toolApproval: {
            apply_ops: (input: { ops?: unknown[] }) => {
              const ops = Array.isArray(input?.ops) ? input.ops : [];
              const needs = ops.some((o) => isDestructive(o as { type?: string }));
              return needs ? ("user-approval" as const) : ("approved" as const);
            },
          },
        }
      : {}),
  });
}
