import type { Act } from "@/lib/schema";

const SUPPORTING_MAX = 4;
const AMBIENT_MAX = 4;

/**
 * Auto rotation (§6.3): pack widgets into acts that fit landscape capacity
 * (1 hero + 4 supporting + 4 ambient). Anchors persist in every act's
 * ambient rail. Packing order follows widget insertion order.
 */
export function generateAutoActs(widgetIds: string[], anchors: string[] = []): Act[] {
  const anchorSet = new Set(anchors);
  const packable = widgetIds.filter((id) => !anchorSet.has(id));

  if (packable.length === 0) {
    return [{ supporting: [], ambient: [...anchors] }];
  }

  const acts: Act[] = [];
  let i = 0;

  while (i < packable.length) {
    const hero = packable[i++];
    const supporting: string[] = [];
    while (supporting.length < SUPPORTING_MAX && i < packable.length) {
      supporting.push(packable[i++]!);
    }

    const ambientExtra: string[] = [];
    const ambientSlots = Math.max(0, AMBIENT_MAX - anchors.length);
    while (ambientExtra.length < ambientSlots && i < packable.length) {
      ambientExtra.push(packable[i++]!);
    }

    acts.push({
      hero,
      supporting,
      ambient: [...new Set([...anchors, ...ambientExtra])],
    });
  }

  return acts;
}
