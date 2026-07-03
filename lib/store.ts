import { create } from "zustand";
import type { Scene, Op } from "./schema";
import { reduce, reduceBatch, mergeWidgetData } from "./reducer";
import { homelabScene, scenePresets } from "@/fixtures/scenes";
import { momentBus } from "./moments/bus";
import { evaluateMoment } from "./moments/evaluate";

// Fixed epoch so SSR and client agree on staleness timestamps (hydration-safe).
const INITIAL_UPDATED_AT = Date.UTC(2026, 6, 3, 22, 0, 0);

function freshLastUpdated(scene: Scene): Record<string, number> {
  const now = Date.now();
  return Object.fromEntries(scene.widgets.map((w) => [w.id, now]));
}

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
function runSideEffects(
  op: Op,
  scene: Scene,
  lastUpdated: Record<string, number>
): "t2" | "t3" | null {
  if (op.type === "triggerMoment") {
    momentBus.trigger(op.id, op.tier);
    return null;
  }

  if (op.type === "pushData") {
    lastUpdated[op.id] = Date.now();
    const widget = scene.widgets.find((w) => w.id === op.id);
    if (!widget) return null;
    const merged = mergeWidgetData(widget.data, op.data);
    const tier = evaluateMoment(widget, widget.data, merged);
    if (tier !== "t0") momentBus.trigger(op.id, tier);
    return tier === "t2" || tier === "t3" ? tier : null;
  }

  return null;
}

function needsFreshTimestamps(op: Op): boolean {
  return op.type === "loadScene" || op.type === "setScene";
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  scene: homelabScene,
  lastUpdated: Object.fromEntries(homelabScene.widgets.map((w) => [w.id, INITIAL_UPDATED_AT])),
  applyOp: (op) => {
    const scene = get().scene;
    const lastUpdated = { ...get().lastUpdated };
    const momentTier = runSideEffects(op, scene, lastUpdated);
    let nextScene = reduce(scene, op, { scenesByName: scenePresets });

    if (momentTier && op.type === "pushData") {
      nextScene = reduce(
        nextScene,
        { type: "triggerMoment", id: op.id, tier: momentTier },
        { scenesByName: scenePresets }
      );
    }

    set({
      scene: nextScene,
      lastUpdated: needsFreshTimestamps(op) ? freshLastUpdated(nextScene) : lastUpdated,
    });
  },
  applyOps: (ops) => {
    let scene = get().scene;
    const lastUpdated = { ...get().lastUpdated };
    ops.forEach((op) => {
      runSideEffects(op, scene, lastUpdated);
      scene = reduce(scene, op, { scenesByName: scenePresets });
    });
    const reset = ops.some(needsFreshTimestamps);
    set({ scene, lastUpdated: reset ? freshLastUpdated(scene) : lastUpdated });
  },
}));
