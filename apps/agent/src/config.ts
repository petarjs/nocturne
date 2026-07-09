// Config resolution: env vars (matching the repo's NOCTURNE_* conventions) plus
// CLI flags, which win over env. No dependency — a tiny hand-rolled arg parser.

export type Mode = "chat" | "once" | "tick";

export type Config = {
  api: string;
  web: string;
  dash: string;
  key?: string;
  viewCode?: string;
  anthropicApiKey?: string;
  gateway: boolean;
  model: string;
  tickModel: string;
  tickIntervalMs: number;
  mode: Mode;
  prompt?: string;
  once: boolean;
  dryRun: boolean;
  yes: boolean;
};

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_INTERVAL = "10m";

/** "10m" | "90s" | "500ms" | "1h" | "45" (bare number = seconds) → milliseconds. */
export function parseIntervalMs(input: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(input.trim());
  if (!m) throw new Error(`invalid interval "${input}" (use e.g. 30s, 10m, 1h)`);
  const n = Number(m[1]);
  const unit = m[2] ?? "s";
  const mult = unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000;
  return Math.round(n * mult);
}

export function loadConfig(argv: string[] = process.argv.slice(2)): Config {
  const env = process.env;

  let dash = env.NOCTURNE_DASH || "living-room";
  let model = env.NOCTURNE_AGENT_MODEL || DEFAULT_MODEL;
  let tickModel = env.NOCTURNE_TICK_MODEL || "";
  let api = env.NOCTURNE_API || "http://localhost:8787";
  let web = env.NOCTURNE_WEB || "http://localhost:3000";
  let interval = env.NOCTURNE_TICK_INTERVAL || DEFAULT_INTERVAL;
  let viewCode = env.NOCTURNE_VIEW_CODE || undefined;
  let once = false;
  let dryRun = false;
  let yes = false;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-d": case "--dashboard": dash = argv[++i]; break;
      case "-m": case "--model": model = argv[++i]; break;
      case "--tick-model": tickModel = argv[++i]; break;
      case "--api": api = argv[++i]; break;
      case "--web": web = argv[++i]; break;
      case "--interval": interval = argv[++i]; break;
      case "--view-code": viewCode = argv[++i]; break;
      case "--once": once = true; break;
      case "--dry-run": dryRun = true; break;
      case "-y": case "--yes": yes = true; break;
      default:
        if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
        positionals.push(a);
    }
  }

  const sub = positionals[0];
  let mode: Mode = "chat";
  if (sub === "tick") mode = "tick";
  else if (sub === "chat") mode = "chat";
  else if (positionals.length > 0) mode = "once";

  const prompt = mode === "once" ? positionals.join(" ") : undefined;
  // Prefer the direct Anthropic provider; fall back to the AI Gateway only when
  // that's the only credential available (or explicitly requested).
  const gateway =
    env.NOCTURNE_MODEL_GATEWAY === "1" || (!env.ANTHROPIC_API_KEY && !!env.AI_GATEWAY_API_KEY);

  return {
    api,
    web,
    dash,
    key: env.NOCTURNE_KEY || undefined,
    viewCode,
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    gateway,
    model,
    tickModel: tickModel || model,
    tickIntervalMs: parseIntervalMs(interval),
    mode,
    prompt,
    once,
    dryRun,
    yes,
  };
}
