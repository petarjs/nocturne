import type { Scene } from "@/lib/schema";
import { observatory } from "@/lib/themes";
import { fixtures } from "./index";

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

export const scenePresets: Record<string, Scene> = {
  homelab: homelabScene,
  rotation: homelabRotationScene,
  sleep: sleepScene,
  minimal: minimalScene,
};
