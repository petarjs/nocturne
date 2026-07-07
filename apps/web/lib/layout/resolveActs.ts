import type { Act, Narrative, Widget } from "@/lib/schema";
import { generateAutoActs } from "./autoActs";

/** Resolve the act list for the current narrative mode (§6.3). */
export function resolveActs(narrative: Narrative, widgets: Widget[]): Act[] {
  const widgetIds = widgets.map((w) => w.id);
  const anchors = narrative.anchors ?? [];

  if (narrative.rotation.mode === "auto") {
    const pinnedIds = widgets.filter((w) => w.pinned).map((w) => w.id);
    return generateAutoActs(widgetIds, anchors, pinnedIds);
  }

  return narrative.acts.length > 0 ? narrative.acts : [{ supporting: [], ambient: anchors }];
}
