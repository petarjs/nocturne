// Shared helpers for the scripts/push-*.mjs data feeders.
// Plain Node (no deps) so `node scripts/push-whatever.mjs` just works.

import { createInterface } from "node:readline/promises";

export async function prompt(question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question}${suffix}: `);
  rl.close();
  return answer.trim() || defaultValue;
}

export async function promptSecret(question) {
  // No TTY-level echo suppression without a dep; good enough for a local box.
  return prompt(question, undefined);
}

export async function getScene(api, dash, key, viewCode) {
  const url = new URL(`${api}/v1/dashboards/${dash}/scene`);
  if (viewCode) url.searchParams.set("code", viewCode);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && body.includes("view_code_required")) {
      throw new Error(
        "GET scene failed (401): this dashboard requires a view code — set NOCTURNE_VIEW_CODE or answer the prompt"
      );
    }
    throw new Error(`GET scene failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function applyOps(api, dash, key, ops) {
  const res = await fetch(`${api}/v1/dashboards/${dash}/ops`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(ops),
  });
  if (!res.ok) {
    throw new Error(`ops failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function pushData(api, dash, key, widgetId, data) {
  const res = await fetch(`${api}/v1/dashboards/${dash}/widgets/${widgetId}/data`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`push to ${widgetId} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Makes sure `widget` exists on the dashboard and is placed somewhere visible
 * (ambient rail of the first act) — addWidget alone doesn't put it on screen,
 * the layout engine only draws widgets a narrative act references.
 */
export async function ensureWidget(api, dash, key, widget, viewCode) {
  const { scene } = await getScene(api, dash, key, viewCode);
  const exists = scene.widgets.some((w) => w.id === widget.id);
  if (!exists) {
    await applyOps(api, dash, key, [{ type: "addWidget", widget }]);
  }

  const acts = scene.narrative.acts.length > 0 ? scene.narrative.acts : [{ supporting: [], ambient: [] }];
  const [firstAct, ...rest] = acts;
  const onScreen =
    firstAct.hero === widget.id ||
    firstAct.supporting.includes(widget.id) ||
    firstAct.ambient.includes(widget.id);
  if (!onScreen) {
    const nextAct = { ...firstAct, ambient: [...firstAct.ambient, widget.id] };
    await applyOps(api, dash, key, [{ type: "setActs", acts: [nextAct, ...rest] }]);
  }

  return !exists;
}
