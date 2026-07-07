import { create } from "zustand";
import type { Scene, Op } from "@nocturne/core";
import { reduce, mergeWidgetData } from "@nocturne/core";
import { homelabScene, scenePresets } from "@nocturne/core/fixtures";
import { momentBus } from "./moments/bus";
import { evaluateMoment, hasActiveAlertCondition } from "./moments/evaluate";

// Fixed epoch so SSR and client agree on staleness timestamps (hydration-safe).
const INITIAL_UPDATED_AT = Date.UTC(2026, 6, 3, 22, 0, 0);

function freshLastUpdated(scene: Scene): Record<string, number> {
  const now = Date.now();
  return Object.fromEntries(scene.widgets.map((w) => [w.id, now]));
}

/** Evaluate static fixture data for sustained alert conditions on scene load. */
function bootstrapSceneAlerts(scene: Scene): Scene {
  let next = scene;
  for (const widget of scene.widgets) {
    if (widget.type === "statusGrid" && hasActiveAlertCondition(widget, widget.data)) {
      next = reduce(next, { type: "triggerMoment", id: widget.id, tier: "t3" }, { scenesByName: scenePresets });
      momentBus.trigger(widget.id, "t3");
    }
  }
  return next;
}

const bootstrappedHomelab = bootstrapSceneAlerts(homelabScene);

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
): "t2" | "t3" | "recovery" | null {
  if (op.type === "triggerMoment") {
    momentBus.trigger(op.id, op.tier);
    return null;
  }

  if (op.type === "pushData") {
    lastUpdated[op.id] = Date.now();
    const widget = scene.widgets.find((w) => w.id === op.id);
    if (!widget) return null;
    const merged = mergeWidgetData(widget.data, op.data);

    if (widget.state === "critical" && !hasActiveAlertCondition(widget, merged)) {
      momentBus.trigger(widget.id, "t2", { accent: "positive" });
      momentBus.clearAlert();
      return "recovery";
    }

    const tier = evaluateMoment(widget, widget.data, merged);
    if (tier !== "t0") momentBus.trigger(op.id, tier);
    return tier === "t2" || tier === "t3" ? tier : null;
  }

  return null;
}

function applyMomentAndRecovery(
  scene: Scene,
  op: Op,
  momentTier: "t2" | "t3" | "recovery" | null
): Scene {
  if (momentTier === "recovery" && op.type === "pushData") {
    let next = updateWidgetState(scene, op.id, "normal");
    if (next.mood === "alert") {
      next = reduce(next, { type: "setMood", mood: "ambient" }, { scenesByName: scenePresets });
    }
    return next;
  }

  if ((momentTier === "t2" || momentTier === "t3") && op.type === "pushData") {
    return reduce(
      scene,
      { type: "triggerMoment", id: op.id, tier: momentTier },
      { scenesByName: scenePresets }
    );
  }

  return scene;
}

function updateWidgetState(scene: Scene, id: string, state: Scene["widgets"][0]["state"]): Scene {
  return {
    ...scene,
    widgets: scene.widgets.map((w) => (w.id === id ? { ...w, state } : w)),
  };
}

function needsFreshTimestamps(op: Op): boolean {
  return op.type === "loadScene" || op.type === "setScene";
}

function finalizeLoadedScene(scene: Scene): Scene {
  return bootstrapSceneAlerts(scene);
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  scene: bootstrappedHomelab,
  lastUpdated: Object.fromEntries(bootstrappedHomelab.widgets.map((w) => [w.id, INITIAL_UPDATED_AT])),
  applyOp: (op) => {
    const scene = get().scene;
    const lastUpdated = { ...get().lastUpdated };
    const momentTier = runSideEffects(op, scene, lastUpdated);
    let nextScene = reduce(scene, op, { scenesByName: scenePresets });
    nextScene = applyMomentAndRecovery(nextScene, op, momentTier);

    if (needsFreshTimestamps(op)) {
      nextScene = finalizeLoadedScene(nextScene);
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
      const momentTier = runSideEffects(op, scene, lastUpdated);
      scene = reduce(scene, op, { scenesByName: scenePresets });
      scene = applyMomentAndRecovery(scene, op, momentTier);
    });
    const reset = ops.some(needsFreshTimestamps);
    if (reset) scene = finalizeLoadedScene(scene);
    set({ scene, lastUpdated: reset ? freshLastUpdated(scene) : lastUpdated });
  },
}));
