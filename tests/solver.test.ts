import { describe, expect, it } from 'vitest';
import { buildCandidate } from '../src/shared/generator';
import { allWishes, evaluateWish, scoreTown } from '../src/shared/rules';
import { freeCells, greedyTown, solve } from '../src/shared/solver';
import type { Puzzle } from '../src/shared/types';

/** Reference implementation: enumerate every town with no pruning at all. */
const bruteForce = (puzzle: Puzzle) => {
  const cells = freeCells(puzzle);
  const wishes = allWishes(puzzle);
  let optimum = -1;
  let perfect = 0;
  const p = [-1, -1, -1, -1, -1];
  const rec = (slot: number) => {
    if (slot === 5) {
      let met = 0;
      for (const w of wishes) if (evaluateWish(w, p, puzzle) === 'met') met++;
      if (met > optimum) optimum = met;
      if (met === wishes.length) perfect++;
      return;
    }
    for (const c of cells) {
      if (p.includes(c)) continue;
      p[slot] = c;
      rec(slot + 1);
      p[slot] = -1;
    }
  };
  rec(0);
  return { optimum, perfect };
};

describe('solver', () => {
  // A Monday-ish and a Sunday-ish candidate, including one that is likely not perfectible.
  const samples = [buildCandidate('2026-11-16', 3), buildCandidate('2026-11-22', 1), buildCandidate('2026-11-20', 7)];

  it.each(samples.map((p) => [`${p.date}#${p.roll}`, p] as const))(
    'branch-and-bound matches exhaustive enumeration (%s)',
    (_label, puzzle) => {
      const fast = solve(puzzle);
      const slow = bruteForce(puzzle);
      expect(fast.optimum).toBe(slow.optimum);
      expect(fast.perfectCount).toBe(slow.perfect);
      expect(scoreTown(puzzle, fast.example).met).toBe(fast.optimum);
    }
  );

  it('greedy town is deterministic, legal and never beats the optimum', () => {
    for (const p of samples) {
      const a = greedyTown(p);
      const b = greedyTown(p);
      expect(a).toEqual(b);
      expect(new Set(a.placement).size).toBe(5);
      const blocked = new Set(p.landmarks.map((l) => l.cell));
      for (const c of a.placement) expect(blocked.has(c)).toBe(false);
      expect(a.score).toBeLessThanOrEqual(solve(p).optimum);
    }
  });
});
