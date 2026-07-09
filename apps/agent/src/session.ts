// First-run onboarding shared by every mode: verify the server is reachable,
// bootstrap an API key if none is set, create the target dashboard if missing,
// and print where to open the display.

import { NocturneClient, NocturneError } from "./client";
import type { Config } from "./config";
import { summarizeScene } from "./prompt";

export async function prepareSession(cfg: Config): Promise<{ client: NocturneClient; sceneSummary: string }> {
  const client = new NocturneClient({ api: cfg.api, key: cfg.key, viewCode: cfg.viewCode });

  // 1. Server reachable?
  try {
    await client.health();
  } catch {
    throw new Error(`Cannot reach the Nocturne server at ${cfg.api}. Is it running?  (pnpm dev:server)`);
  }

  // 2. Ensure we have an API key — bootstrap the first one if none is configured.
  if (!cfg.key) {
    try {
      const k = await client.bootstrapKey("agent");
      client.setKey(k.key);
      cfg.key = k.key;
      console.log(`\n  Minted a bootstrap API key. Save it so you don't create a new one next run:`);
      console.log(`     export NOCTURNE_KEY=${k.key}\n`);
    } catch (e) {
      const reason =
        e instanceof NocturneError && (e.status === 401 || e.status === 409)
          ? `keys already exist — create one in the admin UI (${cfg.web}) and set NOCTURNE_KEY.`
          : `could not mint a key: ${(e as Error).message}`;
      throw new Error(`No NOCTURNE_KEY set and ${reason}`);
    }
  }

  // 3. Ensure the dashboard exists.
  let sceneSummary: string;
  try {
    const s = await client.getScene(cfg.dash);
    sceneSummary = summarizeScene(s.scene, s.rev);
  } catch (e) {
    if (e instanceof NocturneError && e.status === 404) {
      await client.createDashboard({ slug: cfg.dash, name: cfg.dash });
      const s = await client.getScene(cfg.dash);
      sceneSummary = summarizeScene(s.scene, s.rev);
      console.log(`  Created dashboard "${cfg.dash}".`);
    } else {
      throw e;
    }
  }

  console.log(
    `  Dashboard: ${cfg.dash}   Display: ${cfg.web}/d/${cfg.dash}   Model: ${cfg.model}${cfg.dryRun ? "   (dry-run)" : ""}\n`,
  );
  return { client, sceneSummary };
}
