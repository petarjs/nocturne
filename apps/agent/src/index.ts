#!/usr/bin/env node
// @nocturne/agent — an LLM agent that drives a Nocturne dashboard in natural
// language. Modes: chat (default, interactive), a one-shot prompt, and tick
// (autonomous). See README.md.

import { loadConfig } from "./config";
import { runChat } from "./chat";
import { runTick } from "./tick";
import { prepareSession } from "./session";
import { createTools } from "./tools";
import { buildInstructions } from "./prompt";
import { createAgent } from "./agent";

async function main(): Promise<void> {
  const cfg = loadConfig();

  if (cfg.mode === "chat") return runChat(cfg);
  if (cfg.mode === "tick") return runTick(cfg);

  // One-shot: run the prompt to completion, stream the reply, exit.
  const { client, sceneSummary } = await prepareSession(cfg);
  const tools = createTools(client, cfg);
  const agent = createAgent({
    cfg,
    instructions: buildInstructions(cfg, sceneSummary),
    tools,
    which: "agent",
  });
  // generate() runs the full tool loop and throws on model errors (unlike
  // stream(), whose errors are swallowed onto the stream) — so main()'s catch
  // formats them. Live token streaming only matters for the interactive TUI.
  const { text } = await agent.generate({ prompt: cfg.prompt ?? "" });
  process.stdout.write(`${text}\n`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const friendly = /x-api-key|api[ -]?key|authentication/i.test(msg)
    ? `${msg} — check ANTHROPIC_API_KEY.`
    : msg;
  console.error(`\n✗ ${friendly}`);
  process.exit(1);
});
