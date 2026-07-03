export type GridCell = { col: number; row: number; colSpan: number; rowSpan: number };
export type LayoutResult = Record<string, GridCell>;
export type Orientation = "landscape" | "portrait";
