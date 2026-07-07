import type { Act } from "@/lib/schema";
import type { Mood, Widget } from "@/lib/schema";

/**
 * §4.4 t3: promote the affected widget toward hero position — a motivated
 * layout change (§6.4), not a hardcoded big-number widget.
 *
 * §6.4 pins are sacred: a pinned hero is never demoted by promotion. When the
 * hero is pinned, the critical widget rises to the front of supporting instead
 * — as close to hero as the pin allows.
 */
export function promoteForAlert(
  act: Act,
  criticalWidgetId: string,
  pinnedIds: Set<string> = new Set()
): Act {
  if (act.hero === criticalWidgetId) return act;

  if (act.hero && pinnedIds.has(act.hero)) {
    const supporting = [
      criticalWidgetId,
      ...act.supporting.filter((id) => id !== criticalWidgetId),
    ].slice(0, 4);
    const ambient = act.ambient.filter((id) => id !== criticalWidgetId);
    return { ...act, supporting, ambient };
  }

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

/**
 * Overlay mood-driven layout changes on the authored act without mutating
 * narrative storage.
 *
 * §1.3 beat 6 / §4.5: `sleep` reduces the scene to the clock as sole hero —
 * everything else exits via Stage's AnimatePresence. §4.4 t3: `alert` promotes
 * the critical widget toward hero.
 */
export function effectiveAct(
  act: Act,
  mood: Mood,
  widgets: Widget[],
  anchors: string[] = []
): Act {
  if (mood === "sleep") {
    const clock = widgets.find((w) => w.type === "clock");
    const heroId = clock?.id ?? act.hero ?? anchors[0] ?? widgets[0]?.id;
    return { ...act, hero: heroId, supporting: [], ambient: [] };
  }

  if (mood !== "alert") return act;
  const critical = widgets.find((w) => w.state === "critical");
  if (!critical) return act;
  const pinnedIds = new Set(widgets.filter((w) => w.pinned).map((w) => w.id));
  return promoteForAlert(act, critical.id, pinnedIds);
}
