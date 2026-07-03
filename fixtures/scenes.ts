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
        supporting: ["memory", "network", "services"],
        ambient: ["clock", "library"],
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
    {
      id: "library",
      type: "list",
      title: "Continue Watching",
      data: fixtures.list,
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

export const scenePresets: Record<string, Scene> = {
  homelab: homelabScene,
  sleep: sleepScene,
  minimal: minimalScene,
};
