import type { Scene } from "../schema";
import { observatory } from "../themes";
import { fixtures } from "./data";

export const homelabScene: Scene = {
  version: 1,
  name: "Homelab",
  theme: observatory,
  mood: "ambient",
  narrative: {
    anchors: ["clock"],
    acts: [
      {
        hero: "cpu",
        supporting: ["memory", "network"],
        ambient: ["clock", "services"],
      },
    ],
    rotation: { mode: "off", dwellSec: 20, indicator: "none" },
  },
  widgets: [
    { id: "clock", type: "clock", data: fixtures.clock, state: "normal" },
    {
      id: "cpu",
      type: "stat",
      title: "CPU Load",
      data: fixtures.stat,
      thresholds: { t1: 10, t2: 25 },
      state: "normal",
    },
    {
      id: "memory",
      type: "gauge",
      title: "Memory",
      data: fixtures.gauge,
      state: "normal",
    },
    {
      id: "network",
      type: "timeseries",
      title: "Network",
      data: fixtures.timeseries,
      state: "normal",
    },
    {
      id: "services",
      type: "statusGrid",
      title: "Services",
      data: fixtures.statusGrid,
      state: "normal",
    },
  ],
};

export const sleepScene: Scene = {
  version: 1,
  name: "Sleep",
  theme: observatory,
  mood: "sleep",
  narrative: {
    acts: [{ hero: "clock", supporting: [], ambient: [] }],
    rotation: { mode: "off", dwellSec: 20, indicator: "none" },
  },
  widgets: [{ id: "clock", type: "clock", data: fixtures.clock, state: "normal" }],
};

export const minimalScene: Scene = {
  version: 1,
  name: "Minimal",
  theme: observatory,
  mood: "ambient",
  narrative: {
    acts: [{ hero: "clock", supporting: ["headline"], ambient: [] }],
    rotation: { mode: "off", dwellSec: 20, indicator: "none" },
  },
  widgets: [
    { id: "clock", type: "clock", data: fixtures.clock, state: "normal" },
    { id: "headline", type: "headline", data: fixtures.headline, state: "normal" },
  ],
};

export const homelabRotationScene: Scene = {
  version: 1,
  name: "Rotation",
  theme: observatory,
  mood: "ambient",
  narrative: {
    anchors: ["clock"],
    acts: [
      {
        hero: "cpu",
        supporting: ["memory", "network"],
        ambient: ["clock", "services"],
        dwellSec: 12,
      },
      {
        hero: "headline",
        supporting: ["list", "disk"],
        ambient: ["clock", "bandwidth"],
        dwellSec: 12,
      },
    ],
    rotation: { mode: "story", dwellSec: 12, indicator: "hairline" },
  },
  widgets: [
    { id: "clock", type: "clock", data: fixtures.clock, state: "normal" },
    {
      id: "cpu",
      type: "stat",
      title: "CPU Load",
      data: fixtures.stat,
      thresholds: { t1: 10, t2: 25 },
      state: "normal",
    },
    {
      id: "memory",
      type: "gauge",
      title: "Memory",
      data: fixtures.gauge,
      state: "normal",
    },
    {
      id: "network",
      type: "timeseries",
      title: "Network",
      data: fixtures.timeseries,
      state: "normal",
    },
    {
      id: "services",
      type: "statusGrid",
      title: "Services",
      data: fixtures.statusGrid,
      state: "normal",
    },
    {
      id: "list",
      type: "list",
      title: "Top Containers",
      data: fixtures.list,
      state: "normal",
    },
    {
      id: "headline",
      type: "headline",
      data: { text: "Act 2 — media & storage.", kicker: "Chapter", tone: "neutral" },
      state: "normal",
    },
    {
      id: "disk",
      type: "gauge",
      title: "Disk",
      data: {
        label: "Disk",
        value: 54,
        min: 0,
        max: 100,
        warn: 80,
        crit: 92,
      },
      state: "normal",
    },
    {
      id: "bandwidth",
      type: "stat",
      title: "Bandwidth",
      data: {
        label: "Bandwidth",
        value: 199.8,
        unit: "Mbps",
        delta: 12.4,
      },
      state: "normal",
    },
  ],
};

// homelab's statusGrid fixture has a `down` item so it auto-enters alert on
// load (bootstrapSceneAlerts) — exactly right for the golden-frame alert
// frame, wrong for a catalog/story-arc scene that wants to sit in `ambient`.
const cleanStatusGrid = {
  items: [
    { id: "plex", label: "Plex", state: "up", latency: 12 },
    { id: "nas", label: "NAS", state: "up", latency: 4 },
    { id: "pihole", label: "Pi-hole", state: "degraded", latency: 210 },
    { id: "vpn", label: "VPN", state: "up", latency: 38 },
    { id: "homeassistant", label: "Home Assistant", state: "up", latency: 22 },
  ],
};

// Every wired preset across three acts — the fastest way to eyeball a theme or
// dialect against the full catalog instead of the five-widget homelab set.
// Split across two acts; the clock anchor travels between both. Each act
// keeps to 2 supporting widgets — with an ambient rail present, resolveLayout
// (§6.2) only has room to actually place 2 supporting cells beside the hero,
// so a 3rd or 4th supporting id would just be silently dropped rather than
// rendered. The rest of the catalog rides in the ambient rail instead, which
// has no such cap.
export const kitchenSinkScene: Scene = {
  version: 1,
  name: "Kitchen Sink",
  theme: observatory,
  mood: "ambient",
  narrative: {
    anchors: ["clock"],
    acts: [
      {
        hero: "cpu",
        supporting: ["memory", "network"],
        ambient: ["clock", "disk", "storage", "services", "containers"],
      },
      {
        hero: "hosts",
        supporting: ["log", "agenda"],
        ambient: ["clock", "note", "notes-md"],
      },
      {
        hero: "playing",
        supporting: ["weather", "image"],
        ambient: ["clock", "video", "composite-note"],
      },
    ],
    rotation: { mode: "off", dwellSec: 20, indicator: "none" },
  },
  widgets: [
    { id: "clock", type: "clock", data: fixtures.clock, state: "normal" },
    { id: "cpu", type: "stat", title: "CPU Load", data: fixtures.stat, state: "normal" },
    { id: "memory", type: "gauge", title: "Memory", data: fixtures.gauge, state: "normal" },
    { id: "network", type: "timeseries", title: "Network", data: fixtures.timeseries, state: "normal" },
    { id: "disk", type: "barChart", title: "Requests", data: fixtures.barChart, state: "normal" },
    { id: "storage", type: "donut", title: "Storage", data: fixtures.donut, state: "normal" },
    { id: "services", type: "statusGrid", title: "Services", data: cleanStatusGrid, state: "normal" },
    { id: "containers", type: "list", title: "Now Watching", data: fixtures.list, state: "normal" },
    { id: "note", type: "headline", data: fixtures.headline, state: "normal" },
    { id: "hosts", type: "table", title: "Hosts", data: fixtures.table, state: "normal" },
    { id: "log", type: "ticker", title: "Log", data: fixtures.ticker, state: "normal" },
    { id: "agenda", type: "agenda", title: "Agenda", data: fixtures.agenda, state: "normal" },
    { id: "notes-md", type: "text", data: fixtures.text, state: "normal" },
    {
      id: "playing",
      type: "nowPlaying",
      title: "Now Playing",
      data: { ...(fixtures.nowPlaying as Record<string, unknown>), artUrl: "/fixtures/placeholder.svg" },
      state: "normal",
    },
    { id: "weather", type: "weather", title: "Outside", data: fixtures.weather, state: "normal" },
    { id: "image", type: "image", title: "North Ridge", data: fixtures.image, state: "normal" },
    { id: "video", type: "video", title: "Live View", data: fixtures.video, state: "normal" },
    {
      id: "composite-note",
      type: "composite",
      title: "Agent Note",
      archetype: "textCard",
      slots: { kicker: "Agent" },
      data: { text: "The night is quiet.", kicker: "Agent", tone: "neutral" },
      state: "normal",
    },
  ],
};

// Every widget `state` (§8) rendered side by side with mood held at `ambient`
// so nothing auto-promotes to hero (§4.4/alertPromotion) — a clean preview of
// the critical/attention/stale treatments in isolation (Stage.tsx). Only 2
// supporting widgets (see kitchenSinkScene comment above on why); the rest
// sit in the ambient rail.
export const statesScene: Scene = {
  version: 1,
  name: "States",
  theme: observatory,
  mood: "ambient",
  narrative: {
    anchors: ["clock"],
    acts: [
      {
        hero: "cpu",
        supporting: ["memory", "network"],
        ambient: ["clock", "services", "disk", "storage", "containers"],
      },
    ],
    rotation: { mode: "off", dwellSec: 20, indicator: "none" },
  },
  widgets: [
    { id: "clock", type: "clock", data: fixtures.clock, state: "normal" },
    { id: "cpu", type: "stat", title: "CPU Load", data: fixtures.stat, state: "critical" },
    { id: "memory", type: "gauge", title: "Memory", data: fixtures.gauge, state: "attention" },
    { id: "network", type: "timeseries", title: "Network", data: fixtures.timeseries, state: "stale" },
    { id: "services", type: "statusGrid", title: "Services", data: cleanStatusGrid, state: "normal" },
    { id: "disk", type: "barChart", title: "Requests", data: fixtures.barChart, state: "attention" },
    { id: "storage", type: "donut", title: "Storage", data: fixtures.donut, state: "stale" },
    { id: "containers", type: "list", title: "Now Watching", data: fixtures.list, state: "normal" },
  ],
};

// A three-act story arc (§6.3) — one more act than `rotation`'s two, and
// authored `story` mode throughout, for testing longer chapter sequences and
// manual act-switching in the drawer's Acts (test) section.
export const storyArcsScene: Scene = {
  version: 1,
  name: "Story Arcs",
  theme: observatory,
  mood: "ambient",
  narrative: {
    anchors: ["clock"],
    acts: [
      {
        hero: "cpu",
        supporting: ["memory", "network"],
        ambient: ["clock", "services"],
        dwellSec: 10,
      },
      {
        hero: "headline-media",
        supporting: ["list", "disk"],
        ambient: ["clock", "bandwidth"],
        dwellSec: 10,
      },
      {
        hero: "hosts",
        supporting: ["log", "agenda"],
        ambient: ["clock", "storage"],
        dwellSec: 10,
      },
    ],
    rotation: { mode: "story", dwellSec: 10, indicator: "dots" },
  },
  widgets: [
    { id: "clock", type: "clock", data: fixtures.clock, state: "normal" },
    { id: "cpu", type: "stat", title: "CPU Load", data: fixtures.stat, thresholds: { t1: 10, t2: 25 }, state: "normal" },
    { id: "memory", type: "gauge", title: "Memory", data: fixtures.gauge, state: "normal" },
    { id: "network", type: "timeseries", title: "Network", data: fixtures.timeseries, state: "normal" },
    { id: "services", type: "statusGrid", title: "Services", data: cleanStatusGrid, state: "normal" },
    { id: "list", type: "list", title: "Now Watching", data: fixtures.list, state: "normal" },
    {
      id: "headline-media",
      type: "headline",
      data: { text: "Act 2 — media & storage.", kicker: "Chapter", tone: "neutral" },
      state: "normal",
    },
    {
      id: "disk",
      type: "gauge",
      title: "Disk",
      data: { label: "Disk", value: 54, min: 0, max: 100, warn: 80, crit: 92 },
      state: "normal",
    },
    {
      id: "bandwidth",
      type: "stat",
      title: "Bandwidth",
      data: { label: "Bandwidth", value: 199.8, unit: "Mbps", delta: 12.4 },
      state: "normal",
    },
    { id: "hosts", type: "table", title: "Hosts", data: fixtures.table, state: "normal" },
    { id: "log", type: "ticker", title: "Log", data: fixtures.ticker, state: "normal" },
    { id: "agenda", type: "agenda", title: "Agenda", data: fixtures.agenda, state: "normal" },
    { id: "storage", type: "donut", title: "Storage", data: fixtures.donut, state: "normal" },
  ],
};

export const scenePresets: Record<string, Scene> = {
  homelab: homelabScene,
  rotation: homelabRotationScene,
  sleep: sleepScene,
  minimal: minimalScene,
  kitchenSink: kitchenSinkScene,
  states: statesScene,
  storyArcs: storyArcsScene,
};
