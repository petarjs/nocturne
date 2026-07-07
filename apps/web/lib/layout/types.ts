export type GridCell = { col: number; row: number; colSpan: number; rowSpan: number };
export type LayoutResult = Record<string, GridCell>;
export type Orientation = "landscape" | "portrait";

/** Narrative slot resolved by the layout engine (§6.2, §7.2). */
export type WidgetSlot = "hero" | "supporting" | "ambient";
