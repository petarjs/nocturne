import type { Act } from "@/lib/schema";
import type { Mood, Widget } from "@/lib/schema";

/**
 * §4.4 t3: promote the affected widget toward hero position — a motivated
 * layout change (§6.4), not a hardcoded big-number widget.
 */
export function promoteForAlert(act: Act, criticalWidgetId: string): Act {
  if (act.hero === criticalWidgetId) return act;

  const supporting = act.supporting.filter((id) => id !== criticalWidgetId);
  const ambient = act.ambient.filter((id) => id !== criticalWidgetId);

  if (act.hero) {
    supporting.unshift(act.hero);
  }

  return {
    ...act,
    hero: criticalWidgetId,
    supporting: supporting.slice(0, 4),
    ambient,
  };
}

/** Overlay alert promotion on the authored act without mutating narrative storage. */
export function effectiveAct(act: Act, mood: Mood, widgets: Widget[]): Act {
  if (mood !== "alert") return act;
  const critical = widgets.find((w) => w.state === "critical");
  if (!critical) return act;
  return promoteForAlert(act, critical.id);
}
