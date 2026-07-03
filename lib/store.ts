import { create } from "zustand";
import type { Scene, Op } from "./schema";
import { reduce, reduceBatch } from "./reducer";
import { homelabScene, scenePresets } from "@/fixtures/scenes";
import { momentBus } from "./moments/bus";

type SceneStore = {
  scene: Scene;
  /** side channel, not scene state: last time each widget's data changed (§4.5 staleness) */
  lastUpdated: Record<string, number>;
  applyOp: (op: Op) => void;
  applyOps: (ops: Op[]) => void;
};

// The pure reducer decides *what* the scene becomes; these are the host-layer
// side effects that ride along with certain ops (timed choreography, a
// staleness clock) without the reducer itself needing to be impure.
function runSideEffects(op: Op, lastUpdated: Record<string, number>) {
  if (op.type === "triggerMoment") {
    momentBus.trigger(op.id, op.tier);
  }
  if (op.type === "pushData") {
    lastUpdated[op.id] = Date.now();
  }
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  scene: homelabScene,
  lastUpdated: Object.fromEntries(homelabScene.widgets.map((w) => [w.id, Date.now()])),
  applyOp: (op) => {
    const lastUpdated = { ...get().lastUpdated };
    runSideEffects(op, lastUpdated);
    set({ scene: reduce(get().scene, op, { scenesByName: scenePresets }), lastUpdated });
  },
  applyOps: (ops) => {
    const lastUpdated = { ...get().lastUpdated };
    ops.forEach((op) => runSideEffects(op, lastUpdated));
    set({ scene: reduceBatch(get().scene, ops, { scenesByName: scenePresets }), lastUpdated });
  },
}));
