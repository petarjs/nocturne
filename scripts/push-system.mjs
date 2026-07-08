#!/usr/bin/env node
//
// Nocturne — push this machine's CPU and memory usage onto a dashboard.
//
// Prompts for the dashboard and API key, creates `cpu` and `memory` gauge
// widgets if they don't already exist, then samples and pushes both every 5s.
//
//     node scripts/push-system.mjs
//
// Env vars skip the prompts: NOCTURNE_API, NOCTURNE_DASH, NOCTURNE_KEY,
// NOCTURNE_VIEW_CODE.

import { cpus, totalmem, freemem } from "node:os";
import { prompt, promptSecret, ensureWidget, pushData } from "./lib/nocturne-client.mjs";

const PUSH_MS = 5_000;

function cpuTimes() {
  return cpus().reduce(
    (acc, c) => {
      acc.idle += c.times.idle;
      acc.total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
      return acc;
    },
    { idle: 0, total: 0 }
  );
}

// % busy since the last sample (deltas, not an instantaneous snapshot).
function cpuPercent(prev, next) {
  const idleDelta = next.idle - prev.idle;
  const totalDelta = next.total - prev.total;
  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}

function memPercent() {
  const total = totalmem();
  const used = total - freemem();
  return Math.round((used / total) * 1000) / 10;
}

async function main() {
  const api = process.env.NOCTURNE_API || (await prompt("Nocturne API URL", "http://localhost:8787"));
  const dash = process.env.NOCTURNE_DASH || (await prompt("Dashboard slug"));
  const key = process.env.NOCTURNE_KEY || (await promptSecret("API key"));
  const viewCode = process.env.NOCTURNE_VIEW_CODE || (await prompt("View code (blank if none)", ""));

  if (!dash || !key) {
    console.error("Dashboard slug and API key are required.");
    process.exit(1);
  }

  const cpuWidget = {
    id: "cpu",
    type: "gauge",
    title: "CPU",
    data: { label: "CPU", value: 0, min: 0, max: 100, warn: 70, crit: 90 },
    state: "normal",
  };
  const memWidget = {
    id: "memory",
    type: "gauge",
    title: "Memory",
    data: { label: "Memory", value: 0, min: 0, max: 100, warn: 80, crit: 95 },
    state: "normal",
  };

  const createdCpu = await ensureWidget(api, dash, key, cpuWidget, viewCode);
  const createdMem = await ensureWidget(api, dash, key, memWidget, viewCode);
  console.log(createdCpu ? 'Created widget "cpu".' : 'Widget "cpu" already exists — reusing it.');
  console.log(createdMem ? 'Created widget "memory".' : 'Widget "memory" already exists — reusing it.');

  console.log(`Pushing CPU + memory to ${api} (${dash}) every ${PUSH_MS / 1000}s. Ctrl+C to stop.`);

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    console.log("\nStopping.");
    process.exit(0);
  });

  let prevCpu = cpuTimes();
  while (!stopping) {
    await new Promise((r) => setTimeout(r, PUSH_MS));
    const nextCpu = cpuTimes();
    const cpuPct = cpuPercent(prevCpu, nextCpu);
    prevCpu = nextCpu;
    const memPct = memPercent();

    try {
      await pushData(api, dash, key, "cpu", { value: cpuPct });
      await pushData(api, dash, key, "memory", { value: memPct });
      console.log(`${new Date().toISOString()} cpu: ${cpuPct}%  memory: ${memPct}%`);
    } catch (err) {
      console.error(`${new Date().toISOString()} error: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
