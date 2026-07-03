import type { Scene, Op, Widget } from "./schema";

export type ReducerDeps = {
  /** named scenes available to `loadScene`; the host owns persistence, the reducer stays pure */
  scenesByName?: Record<string, Scene>;
};

function updateWidgetById(scene: Scene, id: string, fn: (w: Widget) => Widget): Scene {
  return { ...scene, widgets: scene.widgets.map((w) => (w.id === id ? fn(w) : w)) };
}

export function reduce(scene: Scene, op: Op, deps: ReducerDeps = {}): Scene {
  switch (op.type) {
    case "setNarrative":
      return { ...scene, narrative: op.narrative };

    case "setActs":
      return { ...scene, narrative: { ...scene.narrative, acts: op.acts } };

    case "setRotation":
      return { ...scene, narrative: { ...scene.narrative, rotation: op.rotation } };

    case "addWidget":
      if (scene.widgets.some((w) => w.id === op.widget.id)) return scene;
      return { ...scene, widgets: [...scene.widgets, op.widget] };

    case "removeWidget":
      return {
        ...scene,
        widgets: scene.widgets.filter((w) => w.id !== op.id),
        narrative: {
          ...scene.narrative,
          anchors: scene.narrative.anchors?.filter((id) => id !== op.id),
          acts: scene.narrative.acts.map((act) => ({
            ...act,
            hero: act.hero === op.id ? undefined : act.hero,
            supporting: act.supporting.filter((id) => id !== op.id),
            ambient: act.ambient.filter((id) => id !== op.id),
          })),
        },
      };

    case "updateWidget":
      return updateWidgetById(scene, op.id, (w) => ({ ...w, ...op.patch }));

    case "pinWidget":
      return updateWidgetById(scene, op.id, (w) => ({ ...w, pinned: op.pinned }));

    case "setTheme":
      return { ...scene, theme: op.theme };

    case "setBackground": {
      if (!("palette" in scene.theme)) return scene; // theme is a preset ref, not resolved tokens
      return {
        ...scene,
        theme: {
          ...scene.theme,
          background: { ...scene.theme.background, engine: op.engine, preset: op.preset, params: op.params },
        },
      };
    }

    case "setMood":
      return { ...scene, mood: op.mood };

    case "triggerMoment": {
      const next = updateWidgetById(scene, op.id, (w) => ({
        ...w,
        state: op.tier === "t3" ? "critical" : op.tier === "t2" ? "attention" : w.state,
      }));
      // alert mood is entered automatically by t3 (§4.5); it's cleared
      // explicitly (condition clears / op resets it), not by the reducer.
      return op.tier === "t3" ? { ...next, mood: "alert" } : next;
    }

    case "setScene":
      return op.scene;

    case "saveScene":
      // persistence is a host-layer side effect; the reducer only reflects the name
      return { ...scene, name: op.name };

    case "loadScene":
      return deps.scenesByName?.[op.name] ?? scene;

    case "pushData":
      return updateWidgetById(scene, op.id, (w) => ({ ...w, data: op.data, state: "normal" }));

    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

export function reduceBatch(scene: Scene, ops: Op[], deps: ReducerDeps = {}): Scene {
  return ops.reduce((s, op) => reduce(s, op, deps), scene);
}
