import { create } from "zustand";
import type { Scene, Op } from "./schema";
import { reduce, reduceBatch } from "./reducer";
import { homelabScene, scenePresets } from "@/fixtures/scenes";

type SceneStore = {
  scene: Scene;
  applyOp: (op: Op) => void;
  applyOps: (ops: Op[]) => void;
};

export const useSceneStore = create<SceneStore>((set, get) => ({
  scene: homelabScene,
  applyOp: (op) => set({ scene: reduce(get().scene, op, { scenesByName: scenePresets }) }),
  applyOps: (ops) => set({ scene: reduceBatch(get().scene, ops, { scenesByName: scenePresets }) }),
}));
