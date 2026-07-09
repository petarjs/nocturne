// Interactive terminal chat, powered by @ai-sdk/tui's runAgentTUI: streamed
// markdown replies, tool cards, and y/n approval prompts for destructive ops.

import { runAgentTUI } from "@ai-sdk/tui";
import type { Config } from "./config";
import { prepareSession } from "./session";
import { createTools } from "./tools";
import { buildInstructions } from "./prompt";
import { createAgent } from "./agent";

export async function runChat(cfg: Config): Promise<void> {
  const { client, sceneSummary } = await prepareSession(cfg);
  const tools = createTools(client, cfg);
  const instructions = buildInstructions(cfg, sceneSummary);
  const agent = createAgent({ cfg, instructions, tools, which: "agent" });

  console.log(`  Talk to your display. Try: "put my homelab up", "make it feel like`);
  console.log(`  cyberpunk noir", "good night".   (Esc or Ctrl+C to exit)\n`);

  await runAgentTUI({
    title: `Nocturne · ${cfg.dash}${cfg.dryRun ? " · dry-run" : ""}`,
    agent,
  });
}
