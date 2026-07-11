// Autonomous proactive mode: reason over the live scene/data on an interval and
// react only when warranted. `--once` runs a single pass (cron/launchd friendly);
// otherwise it loops, non-overlapping, at the configured interval.

import type { Config } from "./config";
import { prepareSession } from "./session";
import { createTools } from "./tools";
import { buildInstructions, summarizeScene } from "./prompt";
import { createAgent } from "./agent";

const TICK_PROMPT =
  "Autonomous tick. Call get_scene, then act only if something meaningful changed since it last looked different; otherwise reply 'No change.' Keep any changes minimal.";

export async function runTick(cfg: Config): Promise<void> {
  const { client } = await prepareSession(cfg);
  const tools = createTools(client, cfg);

  const runOnce = async (): Promise<void> => {
    // Rebuild instructions each tick so the model sees the current scene.
    const s = await client.getScene(cfg.dash);
    const agent = createAgent({
      cfg,
      instructions: buildInstructions(cfg, summarizeScene(s.scene, s.rev)),
      tools,
      which: "tick",
    });
    process.stdout.write(`\n[${new Date().toISOString()}] tick…\n`);
    const { text } = await agent.generate({ prompt: TICK_PROMPT });
    process.stdout.write(`${text}\n`);
  };

  await runOnce();
  if (cfg.once) return;

  process.stdout.write(`\n(ticking every ${Math.round(cfg.tickIntervalMs / 1000)}s — Ctrl+C to stop)\n`);
  process.on("SIGINT", () => process.exit(0));
  for (;;) {
    await sleep(cfg.tickIntervalMs);
    try {
      await runOnce();
    } catch (e) {
      console.error(`tick error: ${(e as Error).message}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
