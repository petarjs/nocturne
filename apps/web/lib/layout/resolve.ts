import type { Act } from "@nocturne/core";
import type { GridCell, LayoutResult, Orientation } from "./types";

const COLS = 12;
const ROWS = 6;

/**
 * The layout engine (§6): narrative roles resolve deterministically into
 * geometry — same document, same layout, always. Agents never place
 * anything; they declare hero/supporting/ambient and this is the only
 * function that turns that into cells. Packing order is stable (role,
 * then insertion order) so layouts don't churn (§6.2).
 *
 * Solved once in landscape's 12×6 local space, then transposed for
 * portrait — transposing a 12×6 grid yields exactly the 6×12 portrait
 * grid the spec calls for, and the ambient bottom strip becomes the
 * ambient right rail for free.
 */
export function resolveLayout(act: Act, orientation: Orientation = "landscape"): LayoutResult {
  const local = solveLandscape(act);
  if (orientation === "landscape") return local;

  const transposed: LayoutResult = {};
  for (const [id, cell] of Object.entries(local)) {
    transposed[id] = { col: cell.row, row: cell.col, colSpan: cell.rowSpan, rowSpan: cell.colSpan };
  }
  return transposed;
}

function solveLandscape(act: Act): LayoutResult {
  const occupied: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const result: LayoutResult = {};

  const occupy = (cell: GridCell) => {
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        if (r < ROWS && c < COLS) occupied[r][c] = true;
      }
    }
  };

  // scans top-left to bottom-right for the first free block — stable and
  // deterministic given a stable input order (§6.2, §6.4)
  const place = (id: string, colSpan: number, rowSpan: number, maxRow: number) => {
    for (let r = 0; r <= maxRow - rowSpan; r++) {
      for (let c = 0; c <= COLS - colSpan; c++) {
        let fits = true;
        for (let rr = r; rr < r + rowSpan && fits; rr++) {
          for (let cc = c; cc < c + colSpan; cc++) {
            if (occupied[rr][cc]) {
              fits = false;
              break;
            }
          }
        }
        if (fits) {
          const cell: GridCell = { col: c, row: r, colSpan, rowSpan };
          occupy(cell);
          result[id] = cell;
          return;
        }
      }
    }
    // Out of room: a full-height (4-row) hero plus a reserved ambient row
    // leaves only one spare row, which can't fit a 2-3 row supporting cell —
    // 3-4 supporting only fully fit an act with no ambient widgets. Capacity
    // enforcement belongs to the narrative editor (§6.2); this just drops
    // the widget rather than overlapping or crashing.
  };

  let heroId = act.hero;
  let supporting = act.supporting.slice(0, 4);
  let promoted = false;
  if (!heroId && supporting.length > 0) {
    // "no hero → first supporting promotes to a 6×3 featured slot" (§6.2)
    heroId = supporting[0];
    supporting = supporting.slice(1);
    promoted = true;
  }

  const hasAmbient = act.ambient.length > 0;
  const contentRows = hasAmbient ? ROWS - 1 : ROWS;

  if (heroId) {
    // Hero is always 8 cols: with a 4-col supporting strip beside it that's
    // the full 12-col width (2/3 + 1/3), no dead columns on the right. A
    // centered hero splits the leftover space into two strips too narrow to
    // pack anything — so centering only happens when there's truly nothing
    // to pack beside it.
    const heroCols = 8;
    // When the ambient strip is present, stretch the hero through the last
    // content row so row 4 doesn't sit empty between the main stage and rail.
    const heroRows = promoted ? 3 : hasAmbient ? contentRows : 4;
    const centered = !promoted && supporting.length === 0;
    const col = centered ? Math.floor((COLS - heroCols) / 2) : 0;
    const cell: GridCell = { col, row: 0, colSpan: heroCols, rowSpan: heroRows };
    occupy(cell);
    result[heroId] = cell;
  }

  // 4×3 only when there's exactly one supporting widget to stack — with two
  // or more, 4×2 is what actually lets them stack within the available rows.
  // When ambient is present, use 3+2 row spans so supporting fills all
  // content rows beside the hero (no dead row under network).
  if (supporting.length >= 2) {
    const spans = hasAmbient ? [3, 2] : [2, 2];
    supporting.forEach((id, i) => {
      place(id, 4, spans[i] ?? 2, contentRows);
    });
  } else {
    const supportCell = { colSpan: 4, rowSpan: hasAmbient ? contentRows : 3 };
    for (const id of supporting) {
      place(id, supportCell.colSpan, supportCell.rowSpan, contentRows);
    }
  }

  if (hasAmbient) {
    const ambient = act.ambient.slice(0, COLS);
    const baseWidth = Math.floor(COLS / ambient.length);
    const remainder = COLS % ambient.length;
    let col = 0;
    ambient.forEach((id, i) => {
      // Spread remainder columns across the leading cells so the rail always
      // uses the full width instead of leaving a dead strip on the right.
      const width = baseWidth + (i < remainder ? 1 : 0);
      result[id] = { col, row: ROWS - 1, colSpan: width, rowSpan: 1 };
      col += width;
    });
  }

  return result;
}
