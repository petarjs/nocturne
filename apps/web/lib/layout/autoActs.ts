import type { Act } from "@nocturne/core";

const SUPPORTING_MAX = 4;
const AMBIENT_MAX = 4;

/**
 * Auto rotation (§6.3): pack widgets into acts that fit landscape capacity
 * (1 hero + 4 supporting + 4 ambient). Anchors persist in every act's
 * ambient rail. Packing order follows widget insertion order.
 *
 * §6.4 pins are sacred: a pinned widget holds its slot through rotation, so —
 * like anchors — it must be present in every generated act. Pinned widgets are
 * pulled out of the rotation pool and prepended to every act's supporting band
 * (a stable, always-visible slot) rather than churning in and out of view.
 */
export function generateAutoActs(
  widgetIds: string[],
  anchors: string[] = [],
  pinnedIds: string[] = []
): Act[] {
  const anchorSet = new Set(anchors);
  // anchors already persist via the ambient rail; a widget that is both an
  // anchor and pinned is handled by the anchor path, not double-placed.
  const pins = pinnedIds.filter((id) => !anchorSet.has(id));
  const pinSet = new Set(pins);
  const packable = widgetIds.filter((id) => !anchorSet.has(id) && !pinSet.has(id));

  // supporting slots left for the rotating pool after reserving pin slots
  const supportingSlots = Math.max(0, SUPPORTING_MAX - pins.length);

  const withPins = (act: Act): Act => ({
    ...act,
    supporting: [...pins, ...act.supporting].slice(0, SUPPORTING_MAX),
  });

  if (packable.length === 0) {
    return [withPins({ supporting: [], ambient: [...anchors] })];
  }

  const acts: Act[] = [];
  let i = 0;

  while (i < packable.length) {
    const hero = packable[i++];
    const supporting: string[] = [];
    while (supporting.length < supportingSlots && i < packable.length) {
      supporting.push(packable[i++]!);
    }

    const ambientExtra: string[] = [];
    const ambientSlots = Math.max(0, AMBIENT_MAX - anchors.length);
    while (ambientExtra.length < ambientSlots && i < packable.length) {
      ambientExtra.push(packable[i++]!);
    }

    acts.push(
      withPins({
        hero,
        supporting,
        ambient: [...new Set([...anchors, ...ambientExtra])],
      })
    );
  }

  return acts;
}
