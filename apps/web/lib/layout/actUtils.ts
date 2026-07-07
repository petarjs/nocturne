import type { Act } from "@nocturne/core";

export function actHasWidget(act: Act, widgetId: string): boolean {
  return act.hero === widgetId || act.supporting.includes(widgetId) || act.ambient.includes(widgetId);
}

export function widgetsInAct(act: Act): string[] {
  return [act.hero, ...act.supporting, ...act.ambient].filter((id): id is string => !!id);
}
