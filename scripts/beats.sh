#!/usr/bin/env bash
#
# Nocturne — the six-beat go/no-go runbook (§1.3 / §10 acceptance).
#
# Drives the real control plane (§9.2) to perform the demo beats that don't
# need MCP summoning: 1 (idle), 3 (react), 4 (transform), 5 (alert), 6 (sleep).
#
# Prereqs: the server running (pnpm dev:server), an API key, a dashboard, and
# the display open on it so the WebSocket carries every beat to the screen:
#
#     open "http://localhost:3000/display?d=living-room"
#
#     NOCTURNE_KEY=noct_… ./scripts/beats.sh            # run every beat
#     NOCTURNE_KEY=noct_… source scripts/beats.sh; beat5 # fire one beat
#
# Env: NOCTURNE_API (default http://localhost:9876), NOCTURNE_DASH (default
# living-room), NOCTURNE_KEY (required — create one at http://localhost:3000).
#
# Beat 2 (Summon) is intentionally absent — it's the MCP path, Phase B (§11).

set -euo pipefail

API="${NOCTURNE_API:-http://localhost:9876}"
DASH="${NOCTURNE_DASH:-living-room}"
OPS="$API/v1/dashboards/$DASH/ops"

if [[ -z "${NOCTURNE_KEY:-}" ]]; then
  echo "NOCTURNE_KEY is required (create an API key on the admin page)" >&2
  exit 1
fi

# POST one or more ops (a JSON array) and pretty-print nothing — the screen is
# the output. Fails loudly on a non-2xx so a broken beat is obvious on the wall.
op() {
  curl -sS -f -X POST "$OPS" \
    -H "Authorization: Bearer $NOCTURNE_KEY" \
    -H 'content-type: application/json' \
    -d "$1" > /dev/null \
    && echo "  ✓ ops applied" \
    || { echo "  ✗ ops failed — is the server up and the dashboard created?"; return 1; }
}

pause() { sleep "${1:-4}"; }

SERVICES_UP='{"items":[{"id":"plex","label":"Plex","state":"up","latency":12},{"id":"nas","label":"NAS","state":"up","latency":4},{"id":"vpn","label":"VPN","state":"up","latency":38},{"id":"backup","label":"Backup Job","state":"up","latency":9}]}'
SERVICES_DOWN='{"items":[{"id":"plex","label":"Plex","state":"up","latency":12},{"id":"nas","label":"NAS","state":"up","latency":4},{"id":"vpn","label":"VPN","state":"up","latency":38},{"id":"backup","label":"Backup Job","state":"down"}]}'

beat1() {
  echo "Beat 1 — Idle. A clean scene breathes."
  op '[{"type":"loadScene","name":"minimal"},{"type":"setMood","mood":"ambient"}]'
}

beat3() {
  echo "Beat 3 — React. CPU spikes; the gauge rolls and a ripple travels out."
  # Load the full homelab first with services healthy so bootstrap stays calm,
  # then let it settle before the spike so the CPU widget exists to diff against.
  op "[{\"type\":\"loadScene\",\"name\":\"homelab\"},{\"type\":\"setMood\",\"mood\":\"ambient\"},{\"type\":\"pushData\",\"id\":\"services\",\"data\":$SERVICES_UP}]"
  pause 4
  echo "  … CPU 42 → 88 (t2 ripple)"
  op '[{"type":"pushData","id":"cpu","data":{"value":88}}]'
}

beat4() {
  echo "Beat 4 — Transform. One orchestrated 1.6s morph to Noir."
  op '[{"type":"setTheme","theme":{"preset":"noir"}}]'
}

beat5() {
  echo "Beat 5 — Alert. A container dies; red bleeds in, status promotes to hero."
  op "[{\"type\":\"pushData\",\"id\":\"services\",\"data\":$SERVICES_DOWN},{\"type\":\"triggerMoment\",\"id\":\"services\",\"tier\":\"t3\"}]"
  pause 5
  echo "  … recovery: service restored, positive t2, clean demotion."
  op "[{\"type\":\"pushData\",\"id\":\"services\",\"data\":$SERVICES_UP},{\"type\":\"updateWidget\",\"id\":\"services\",\"patch\":{\"state\":\"normal\"}},{\"type\":\"setMood\",\"mood\":\"ambient\"}]"
}

beat6() {
  echo "Beat 6 — Sleep. The scene dissolves to a clock over a starfield."
  op '[{"type":"setMood","mood":"sleep"}]'
  pause 6
  echo "  … Good morning. Wake is equally clean."
  op '[{"type":"setMood","mood":"ambient"}]'
}

run_all() {
  beat1; pause 5
  beat3; pause 6
  beat4; pause 4
  beat5; pause 5
  beat6
  echo "Runbook complete."
}

# If executed (not sourced), run the whole runbook.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  run_all
fi
