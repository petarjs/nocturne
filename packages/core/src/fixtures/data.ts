import type { PresetType } from "../schema";

// Fixtures are evaluated on both the server (SSR) and the client
// (hydration) — Math.random()/Date.now() at module scope would diverge
// between the two and break hydration, so fixture "randomness" is a fixed
// pseudo-random sequence instead.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIXTURE_EPOCH = Date.UTC(2026, 6, 3, 22, 0, 0);

function sparkline(base: number, n = 60, wobble = 0.08) {
  const rand = mulberry32(Math.round(base * 1000));
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.5) * base * wobble;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

function series(n = 60, base = 40, wobble = 12) {
  const rand = mulberry32(Math.round(base * 1000) + n);
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v += (rand() - 0.5) * wobble;
    v = Math.max(0, v);
    return { t: FIXTURE_EPOCH - (n - i) * 60_000, v: Math.round(v * 10) / 10 };
  });
}

export const fixtures: Record<PresetType, unknown> = {
  clock: {},

  stat: {
    label: "CPU Load",
    value: 42.3,
    unit: "%",
    delta: 3.1,
    spark: sparkline(42),
  },

  gauge: {
    label: "Memory",
    value: 68,
    min: 0,
    max: 100,
    warn: 75,
    crit: 90,
    unit: "%",
  },

  timeseries: {
    label: "Network Throughput",
    series: series(60, 40, 15),
    window: "1h",
    unit: "Mbps",
  },

  barChart: {
    label: "Requests by Region",
    categories: [
      { label: "us-east", value: 1240 },
      { label: "us-west", value: 860 },
      { label: "eu-central", value: 640 },
      { label: "ap-south", value: 320 },
    ],
  },

  donut: {
    label: "Storage",
    segments: [
      { label: "media", value: 480 },
      { label: "backups", value: 210 },
      { label: "system", value: 90 },
      { label: "free", value: 220 },
    ],
  },

  statusGrid: {
    items: [
      { id: "plex", label: "Plex", state: "up", latency: 12 },
      { id: "nas", label: "NAS", state: "up", latency: 4 },
      { id: "pihole", label: "Pi-hole", state: "degraded", latency: 210 },
      { id: "vpn", label: "VPN", state: "up", latency: 38 },
      { id: "backup", label: "Backup Job", state: "down" },
      { id: "homeassistant", label: "Home Assistant", state: "up", latency: 22 },
    ],
  },

  table: {
    columns: [
      { key: "host", label: "Host", type: "text" },
      { key: "cpu", label: "CPU", type: "num" },
      { key: "trend", label: "Δ", type: "delta" },
      { key: "state", label: "State", type: "status" },
    ],
    rows: [
      { host: "nuc-01", cpu: 34, trend: -2, state: "up" },
      { host: "nuc-02", cpu: 71, trend: 12, state: "up" },
      { host: "rpi-nas", cpu: 18, trend: 0, state: "up" },
      { host: "rpi-dns", cpu: 92, trend: 40, state: "degraded" },
    ],
  },

  list: {
    items: [
      { id: "1", label: "Inception", value: "2h 28m" },
      { id: "2", label: "The Bear S3E1", value: "31m" },
      { id: "3", label: "Arrival", value: "1h 56m" },
      { id: "4", label: "Chernobyl E1", value: "1h 2m" },
    ],
  },

  ticker: {
    lines: [
      { t: "22:04", text: "backup job completed", level: "info" },
      { t: "21:58", text: "pihole query rate elevated", level: "warn" },
      { t: "21:40", text: "nuc-02 cpu sustained > 90%", level: "error" },
      { t: "21:12", text: "vpn peer reconnected", level: "info" },
    ],
  },

  nowPlaying: {
    title: "Weightless",
    artist: "Marconi Union",
    progress: 0.42,
    state: "playing",
  },

  weather: {
    tempC: 14,
    condition: "overcast",
    hi: 17,
    lo: 9,
    hourly: [
      { t: "18:00", tempC: 15 },
      { t: "19:00", tempC: 14 },
      { t: "20:00", tempC: 13 },
      { t: "21:00", tempC: 12 },
    ],
  },

  agenda: {
    events: [
      { id: "1", title: "Standup", startsAt: "09:00", endsAt: "09:15" },
      { id: "2", title: "Design review", startsAt: "11:00", endsAt: "12:00" },
      { id: "3", title: "Focus block", startsAt: "14:00", endsAt: "16:00" },
    ],
  },

  headline: {
    text: "All systems nominal.",
    kicker: "Status",
    tone: "positive",
  },

  text: {
    md: "Nothing scheduled tonight. **Sleep well.**",
  },

  image: {
    src: "/fixtures/placeholder.svg",
    alt: "Abstract nocturnal landscape",
    fit: "cover",
    kenBurns: true,
  },

  video: {
    // The catalog intentionally exercises the tier-aware poster fallback;
    // real dashboards provide their own direct video URL.
    src: "",
    poster: "/fixtures/placeholder.svg",
    loop: true,
  },
};

export function fixtureFor(type: PresetType) {
  return fixtures[type];
}
