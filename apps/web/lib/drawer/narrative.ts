import type { Act } from "@/lib/schema";

export type WidgetRole = "hero" | "supporting" | "ambient" | "off";

export function widgetRole(act: Act, widgetId: string): WidgetRole {
  if (act.hero === widgetId) return "hero";
  if (act.supporting.includes(widgetId)) return "supporting";
  if (act.ambient.includes(widgetId)) return "ambient";
  return "off";
}

export function setWidgetRole(act: Act, widgetId: string, role: WidgetRole): Act {
  let { hero, supporting, ambient } = act;
  supporting = supporting.filter((id) => id !== widgetId);
  ambient = ambient.filter((id) => id !== widgetId);
  if (hero === widgetId) hero = undefined;

  if (role === "hero") {
    if (hero && hero !== widgetId) supporting = [...supporting, hero];
    hero = widgetId;
  } else if (role === "supporting") {
    supporting = [...supporting, widgetId];
  } else if (role === "ambient") {
    ambient = [...ambient, widgetId];
  }

  return { ...act, hero, supporting, ambient };
}
