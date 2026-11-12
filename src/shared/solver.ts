import { CELLS } from './grid';
import { allWishes, evaluateWish } from './rules';
import type { Placement, Puzzle, Wish } from './types';

export type SolveResult = {
  /** Most wishes any town can satisfy. */
  optimum: number;
  total: number;
  /** Number of distinct towns (building-to-lot assignments) that satisfy every wish. */
  perfectCount: number;
  /** One optimal town, for the generator's records. */
  example: Placement;
  /** Search nodes visited, for perf notes. */
  nodes: number;
};

export const freeCells = (puzzle: Puzzle): number[] => {
  const blocked = new Set(puzzle.landmarks.map((l) => l.cell));
  const out: number[] = [];
  for (let c = 0; c < CELLS; c++) if (!blocked.has(c)) out.push(c);
  return out;
};

/**
 * Exhaustive branch-and-bound over every assignment of the 5 buildings to free lots.
 * Finds the optimum and counts perfect towns exactly. Wish evaluation is monotone,
 * so met + pending is a valid upper bound for any completion of a partial town.
 */
export const solve = (puzzle: Puzzle): SolveResult => {
  const wishes = allWishes(puzzle);
  const total = wishes.length;
  const cells = freeCells(puzzle);
  const slots = puzzle.buildings.length;
  const placement: Placement = new Array<number>(slots).fill(-1);
  const used = new Uint8Array(CELLS);
  let optimum = -1;
  let perfectCount = 0;
  let example: Placement = [];
  let nodes = 0;

  // Each wish is decided once the last building it depends on is placed
  // (slots are placed in order 0..n-1; "quiet" depends on every building).
  const decidedAt: Wish[][] = Array.from({ length: slots + 1 }, () => []);
  for (const w of wishes) {
    const last = w.type === 'quiet' ? slots - 1 : Math.max(w.a, w.b ?? -1);
    decidedAt[last + 1]!.push(w);
  }
  const undecidedAfter: number[] = [];
  let decided = 0;
  for (let d = 0; d <= slots; d++) {
    decided += decidedAt[d]!.length;
    undecidedAfter[d] = total - decided;
  }

  const dfs = (slot: number, metBefore: number) => {
    nodes++;
    let met = metBefore;
    for (const w of decidedAt[slot]!) if (evaluateWish(w, placement, puzzle) === 'met') met++;
    const upper = met + undecidedAfter[slot]!;
    // Prune only when this branch can neither beat the best nor reach a perfect town.
    if (upper < total && upper <= optimum) return;
    if (slot === slots) {
      if (met > optimum) {
        optimum = met;
        example = [...placement];
      }
      if (met === total) perfectCount++;
      return;
    }
    for (const cell of cells) {
      if (used[cell]) continue;
      used[cell] = 1;
      placement[slot] = cell;
      dfs(slot + 1, met);
      placement[slot] = -1;
      used[cell] = 0;
    }
  };

  dfs(0, 0);
  return { optimum, total, perfectCount, example, nodes };
};

/**
 * The "greedy player": places buildings in resident order, each on the lot that
 * maximises (met - broken) wishes given what is already down, ties to the lowest lot.
 * It never moves a building once placed.
 */
export const greedyTown = (puzzle: Puzzle): { placement: Placement; score: number } => {
  const wishes = allWishes(puzzle);
  const cells = freeCells(puzzle);
  const placement: Placement = new Array<number>(puzzle.buildings.length).fill(-1);
  const used = new Set<number>();
  const value = () => {
    let v = 0;
    for (const w of wishes) {
      const s = evaluateWish(w, placement, puzzle);
      if (s === 'met') v++;
      else if (s === 'broken') v--;
    }
    return v;
  };
  for (let slot = 0; slot < placement.length; slot++) {
    let bestCell = -1;
    let bestValue = -Infinity;
    for (const cell of cells) {
      if (used.has(cell)) continue;
      placement[slot] = cell;
      const v = value();
      if (v > bestValue) {
        bestValue = v;
        bestCell = cell;
      }
    }
    placement[slot] = bestCell;
    used.add(bestCell);
  }
  let score = 0;
  for (const w of wishes) if (evaluateWish(w, placement, puzzle) === 'met') score++;
  return { placement, score };
};
