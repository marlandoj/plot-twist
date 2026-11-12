import { describe, expect, it } from 'vitest';
import { BUILDING_BY_ID } from '../src/shared/catalog';
import {
  addDays,
  buildCandidate,
  checkGates,
  difficultyForDate,
  generateDay,
  RAMP,
} from '../src/shared/generator';
import { isCorner } from '../src/shared/grid';
import { allWishes, RULE_TYPES } from '../src/shared/rules';
import type { GuestResident } from '../src/shared/types';

describe('seeded generator', () => {
  it('is deterministic: the same date and roll gives every player the same street', () => {
    expect(buildCandidate('2026-11-12', 4)).toEqual(buildCandidate('2026-11-12', 4));
    expect(buildCandidate('2026-11-12', 4)).not.toEqual(buildCandidate('2026-11-13', 4));
  });

  it('maps weekdays Monday=0 (easiest) to Sunday=6 (hardest)', () => {
    expect(difficultyForDate('2026-11-16')).toBe(0); // Monday
    expect(difficultyForDate('2026-11-22')).toBe(6); // Sunday
  });

  it('respects the frozen scope: 6x4 street, 5 buildings, 5 residents with 1-2 wishes', () => {
    for (let i = 0; i < 21; i++) {
      const p = buildCandidate(addDays('2026-11-16', i % 7), i);
      expect(p.buildings).toHaveLength(5);
      expect(new Set(p.buildings).size).toBe(5);
      expect(p.residents).toHaveLength(5);
      p.residents.forEach((r, slot) => {
        expect(r.home).toBe(slot);
        expect(r.wishes.length).toBeGreaterThanOrEqual(1);
        expect(r.wishes.length).toBeLessThanOrEqual(2);
        for (const w of r.wishes) {
          expect(w.a).toBe(slot);
          if (w.b !== undefined) expect(w.b).not.toBe(slot);
        }
      });
      expect(allWishes(p)).toHaveLength(RAMP[p.difficulty]!.wishes);
      for (const l of p.landmarks) expect(isCorner(l.cell)).toBe(false);
      expect(new Set(p.landmarks.map((l) => l.cell)).size).toBe(p.landmarks.length);
    }
  });

  it('uses all 12 rule types across a few weeks of candidates', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) for (const w of allWishes(buildCandidate(addDays('2026-11-16', i), 0))) seen.add(w.type);
    expect([...seen].sort()).toEqual([...RULE_TYPES].sort());
  });

  it('ramps difficulty: more wishes later in the week', () => {
    expect(RAMP[0]!.wishes).toBeLessThan(RAMP[6]!.wishes);
    for (let d = 1; d < 7; d++) expect(RAMP[d]!.wishes).toBeGreaterThanOrEqual(RAMP[d - 1]!.wishes);
  });
});

describe('fairness gates', () => {
  const base = { difficulty: 3, wishes: 7, optimum: 7, perfectCount: 40, greedyScore: 5 };

  it('accepts a fair day', () => {
    expect(Object.values(checkGates(base)).every(Boolean)).toBe(true);
  });
  it('rejects a day with no perfect town', () => {
    expect(checkGates({ ...base, optimum: 6, perfectCount: 0 }).perfectExists).toBe(false);
  });
  it('rejects a day with fewer than 3 perfect towns', () => {
    expect(checkGates({ ...base, perfectCount: 2 }).threePerfect).toBe(false);
  });
  it('rejects days where greedy play is too good or too bad', () => {
    expect(checkGates({ ...base, greedyScore: 7 }).greedyBand).toBe(false); // 100%
    expect(checkGates({ ...base, greedyScore: 6 }).greedyBand).toBe(false); // 85.7%
    expect(checkGates({ ...base, greedyScore: 4 }).greedyBand).toBe(false); // 57%
    expect(checkGates({ ...base, greedyScore: 5 }).greedyBand).toBe(true); // 71%
  });
  it('rejects a Sunday that is as loose as a Monday', () => {
    expect(checkGates({ ...base, difficulty: 6, perfectCount: 5000 }).weekdayRamp).toBe(false);
  });

  it('generateDay re-rolls until every gate passes and records why rolls were rejected', () => {
    const { puzzle, stats } = generateDay('2026-11-12');
    expect(Object.values(stats.gates).every(Boolean)).toBe(true);
    expect(Object.values(stats.rejections).reduce((a, b) => a + b, 0)).toBe(stats.rejectedRolls);
    expect(puzzle.roll).toBe(stats.roll);
  });

  it('a community guest is placed in the day, credited, and the day still passes the gates', () => {
    const guest: GuestResident = {
      id: 'c_t1_abc',
      name: 'Marta',
      building: 'florist',
      wishes: [{ type: 'corner' }, { type: 'notAdjacent', other: 'nightclub' }],
      creditedTo: 'some_redditor',
    };
    const { puzzle, stats } = generateDay('2026-11-19', guest);
    const r = puzzle.residents.find((x) => x.creditedTo === 'some_redditor')!;
    expect(r.name).toBe('Marta');
    expect(puzzle.buildings[r.home]).toBe('florist');
    expect(puzzle.buildings).toContain('nightclub');
    expect(r.wishes.map((w) => w.type)).toEqual(['corner', 'notAdjacent']);
    expect(BUILDING_BY_ID[puzzle.buildings[r.wishes[1]!.b!]!].id).toBe('nightclub');
    expect(Object.values(stats.gates).every(Boolean)).toBe(true);
    expect(stats.guestId).toBe(guest.id);
  });
});
