import { describe, expect, it } from 'vitest';
import { COLS, isCorner, isEdge, manhattan, neighbours } from '../src/shared/grid';
import { evaluateWish, RULE_HINTS, RULE_TYPES, PHRASINGS, wishText } from '../src/shared/rules';
import type { Puzzle, RuleType, Wish } from '../src/shared/types';

const at = (row: number, col: number) => row * COLS + col;

const puzzle = (wishes: Wish[]): Puzzle => ({
  date: '2026-11-16',
  roll: 0,
  difficulty: 0,
  landmarks: [{ id: 'fountain', cell: at(1, 2) }],
  buildings: ['bakery', 'bookshop', 'nightclub', 'cafe', 'daycare'],
  residents: [0, 1, 2, 3, 4].map((home) => ({
    name: `R${home}`,
    home,
    look: { skin: 0, hair: 0, hairStyle: 0, accessory: 0 },
    wishes: wishes.filter((w) => w.a === home),
  })),
});

const w = (type: RuleType, extra: Partial<Wish> = {}): Wish => ({ type, a: 0, phrasing: 0, ...extra });
const status = (wish: Wish, placement: number[]) => evaluateWish(wish, placement, puzzle([wish]));
const none = [-1, -1, -1, -1, -1];

describe('grid', () => {
  it('has 4 corners, a 16-lot edge ring and an 8-lot interior', () => {
    const cells = [...Array(24).keys()];
    expect(cells.filter(isCorner)).toEqual([0, 5, 18, 23]);
    expect(cells.filter(isEdge)).toHaveLength(16);
    expect(cells.filter((c) => !isEdge(c))).toHaveLength(8);
  });
  it('neighbours are orthogonal only and stay on the grid', () => {
    expect(neighbours(0).sort((a, b) => a - b)).toEqual([1, 6]);
    expect(neighbours(at(1, 1)).sort((a, b) => a - b)).toEqual([1, 6, 8, 13]);
    expect(manhattan(0, 23)).toBe(8);
  });
});

describe('the 12 wish rules', () => {
  it('there are exactly 12 rule types, each with phrasing and a hint', () => {
    expect(RULE_TYPES).toHaveLength(12);
    expect(new Set(RULE_TYPES).size).toBe(12);
    for (const t of RULE_TYPES) {
      expect(PHRASINGS[t].length).toBeGreaterThan(0);
      expect(RULE_HINTS[t].length).toBeGreaterThan(0);
    }
  });

  const cases: [string, Wish, number[], number[]][] = [
    // [name, wish, placement that meets it, placement that breaks it]
    ['adjacent', w('adjacent', { b: 1 }), [at(0, 0), at(0, 1), -1, -1, -1], [at(0, 0), at(1, 1), -1, -1, -1]],
    ['notAdjacent', w('notAdjacent', { b: 2 }), [at(0, 0), -1, at(1, 1), -1, -1], [at(0, 0), -1, at(1, 0), -1, -1]],
    ['corner', w('corner'), [at(3, 5), -1, -1, -1, -1], [at(3, 4), -1, -1, -1, -1]],
    ['edge', w('edge'), [at(2, 0), -1, -1, -1, -1], [at(2, 1), -1, -1, -1, -1]],
    ['sameRow', w('sameRow', { b: 1 }), [at(2, 0), at(2, 5), -1, -1, -1], [at(2, 0), at(1, 0), -1, -1, -1]],
    ['farFrom', w('farFrom', { b: 2 }), [at(0, 0), -1, at(1, 3), -1, -1], [at(0, 0), -1, at(1, 2), -1, -1]],
    ['sameColumn', w('sameColumn', { b: 1 }), [at(0, 3), at(3, 3), -1, -1, -1], [at(0, 3), at(0, 4), -1, -1, -1]],
    ['inland', w('inland'), [at(1, 1), -1, -1, -1, -1], [at(0, 1), -1, -1, -1, -1]],
    ['northOf', w('northOf', { b: 1 }), [at(0, 0), at(1, 5), -1, -1, -1], [at(1, 0), at(1, 5), -1, -1, -1]],
    ['byLandmark', w('byLandmark', { landmark: 'fountain' }), [at(1, 1), -1, -1, -1, -1], [at(2, 1), -1, -1, -1, -1]],
    ['quiet', w('quiet'), [at(0, 0), at(0, 2), at(2, 0), at(3, 3), at(3, 5)], [at(0, 0), at(0, 1), -1, -1, -1]],
    ['mainStreet', w('mainStreet'), [at(3, 2), -1, -1, -1, -1], [at(2, 2), -1, -1, -1, -1]],
  ];

  it.each(cases)('%s: met, broken, and pending', (_name, wish, good, bad) => {
    expect(status(wish, good)).toBe('met');
    expect(status(wish, bad)).toBe('broken');
    expect(status(wish, none)).toBe('pending');
  });

  it('quiet stays pending until every building is down, but breaks early', () => {
    const q = w('quiet');
    expect(status(q, [at(0, 0), at(3, 5), -1, -1, -1])).toBe('pending');
    expect(status(q, [at(0, 0), at(1, 0), -1, -1, -1])).toBe('broken');
  });

  it('diagonal does not count as next to', () => {
    expect(status(w('adjacent', { b: 1 }), [at(0, 0), at(1, 1), -1, -1, -1])).toBe('broken');
    expect(status(w('notAdjacent', { b: 1 }), [at(0, 0), at(1, 1), -1, -1, -1])).toBe('met');
  });

  it('voices wishes in plain words', () => {
    const p = puzzle([w('corner', { a: 1 }), w('farFrom', { b: 2, a: 4 })]);
    expect(wishText(p.residents[1]!.wishes[0]!, p)).toBe('Put my bookshop on a corner.');
    expect(wishText(p.residents[4]!.wishes[0]!, p)).toBe('Keep the nightclub far from my baby.');
    const q = puzzle([w('farFrom', { b: 2, a: 1 })]);
    expect(wishText(q.residents[1]!.wishes[0]!, q)).toBe('Keep the nightclub far from my bookshop.');
  });
});
