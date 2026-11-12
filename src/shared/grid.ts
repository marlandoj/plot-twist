/** The street: a 6 x 4 grid of lots. Cell index = row * COLS + col. Row 0 is north. */

export const COLS = 6;
export const ROWS = 4;
export const CELLS = COLS * ROWS;

export const rowOf = (cell: number) => Math.floor(cell / COLS);
export const colOf = (cell: number) => cell % COLS;

export const manhattan = (a: number, b: number) =>
  Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));

export const isAdjacent = (a: number, b: number) => manhattan(a, b) === 1;

export const isCorner = (cell: number) => {
  const r = rowOf(cell);
  const c = colOf(cell);
  return (r === 0 || r === ROWS - 1) && (c === 0 || c === COLS - 1);
};

export const isEdge = (cell: number) => {
  const r = rowOf(cell);
  const c = colOf(cell);
  return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
};

export const neighbours = (cell: number): number[] => {
  const r = rowOf(cell);
  const c = colOf(cell);
  const out: number[] = [];
  if (r > 0) out.push(cell - COLS);
  if (r < ROWS - 1) out.push(cell + COLS);
  if (c > 0) out.push(cell - 1);
  if (c < COLS - 1) out.push(cell + 1);
  return out;
};

export const MAIN_STREET_ROW = ROWS - 1;
