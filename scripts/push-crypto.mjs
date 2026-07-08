#!/usr/bin/env node
//
// Nocturne — push a live crypto price onto a dashboard.
//
// Prompts for the dashboard, API key, and a coin (CoinGecko id, e.g. "bitcoin",
// "ethereum", "solana"). Creates a `stat` widget for that coin if one doesn't
// already exist, then polls CoinGecko's public price API every 60s and pushes
// the value + 24h delta onto the widget.
//
// Run it once per coin — each run owns one widget (id `crypto-<coin>`), so
// start it again in another terminal/tab for a second coin.
//
//     node scripts/push-crypto.mjs
//
// Everything can also come from env vars to skip the prompts (handy for
// launchd/systemd units): NOCTURNE_API, NOCTURNE_DASH, NOCTURNE_KEY,
// NOCTURNE_VIEW_CODE, COIN.

import { prompt, promptSecret, ensureWidget, pushData } from "./lib/nocturne-client.mjs";

const POLL_MS = 60_000;

async function fetchPrice(coin) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko request failed (${res.status})`);
  const body = await res.json();
  const entry = body[coin];
  if (!entry) throw new Error(`CoinGecko doesn't know coin id "${coin}" (try the id from coingecko.com/en/coins/<name>)`);
  return { value: entry.usd, delta: entry.usd_24h_change };
}

async function main() {
  const api = process.env.NOCTURNE_API || (await prompt("Nocturne API URL", "http://localhost:8787"));
  const dash = process.env.NOCTURNE_DASH || (await prompt("Dashboard slug"));
  const key = process.env.NOCTURNE_KEY || (await promptSecret("API key"));
  const viewCode = process.env.NOCTURNE_VIEW_CODE || (await prompt("View code (blank if none)", ""));
  const coin = (process.env.COIN || (await prompt("Coin (CoinGecko id)", "bitcoin"))).toLowerCase();

  if (!dash || !key) {
    console.error("Dashboard slug and API key are required.");
    process.exit(1);
  }

  const widgetId = `crypto-${coin}`;
  const label = coin.charAt(0).toUpperCase() + coin.slice(1);

  console.log(`Checking price to seed the widget before it goes live…`);
  const first = await fetchPrice(coin);

  const widget = {
    id: widgetId,
    type: "stat",
    title: label,
    data: { label: `${label} / USD`, value: first.value, unit: "USD", delta: first.delta },
    state: "normal",
  };

  const created = await ensureWidget(api, dash, key, widget, viewCode);
  console.log(created ? `Created widget "${widgetId}".` : `Widget "${widgetId}" already exists — reusing it.`);

  console.log(`Pushing ${label} price to ${api} (${dash}) every ${POLL_MS / 1000}s. Ctrl+C to stop.`);

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    console.log("\nStopping.");
    process.exit(0);
  });

  while (!stopping) {
    try {
      const { value, delta } = await fetchPrice(coin);
      await pushData(api, dash, key, widgetId, { value, delta });
      console.log(`${new Date().toISOString()} ${label}: $${value} (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% 24h)`);
    } catch (err) {
      console.error(`${new Date().toISOString()} error: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
