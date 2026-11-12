import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addDays, buildCandidate, checkGates, difficultyForDate, GATE_NAMES, type DayStats } from '../src/shared/generator';
import { scoreTown } from '../src/shared/rules';
import { greedyTown, solve } from '../src/shared/solver';

type QueueFile = {
  generatedFrom: string;
  days: { postData: { game: string; date: string; roll: number }; stats: DayStats }[];
};

const queue = JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/queue.json'), 'utf8')) as QueueFile;

describe('committed 14-day queue (data/queue.json)', () => {
  it('covers 14 consecutive days', () => {
    expect(queue.days).toHaveLength(14);
    queue.days.forEach((d, i) => expect(d.postData.date).toBe(addDays(queue.generatedFrom, i)));
  });

  // The proof: gates are evaluated from the recorded numbers, not asserted by the generator.
  it.each(queue.days.map((d) => [d.stats.date, d.stats] as const))('%s passes every gate from its recorded stats', (_date, s) => {
    const gates = checkGates(s);
    for (const g of GATE_NAMES) expect(gates[g], `${s.date} ${g}`).toBe(true);
    expect(s.optimum).toBe(s.wishes);
    expect(s.perfectCount).toBeGreaterThanOrEqual(3);
    expect(s.greedyScore / s.optimum).toBeGreaterThanOrEqual(0.6);
    expect(s.greedyScore / s.optimum).toBeLessThanOrEqual(0.85);
    expect(s.difficulty).toBe(difficultyForDate(s.date));
  });

  // And the recorded numbers are true: re-derive the day from its seed and re-solve it.
  it.each(queue.days.map((d) => [d.stats.date, d] as const))('%s stats match an independent re-solve', (_date, d) => {
    const puzzle = buildCandidate(d.postData.date, d.postData.roll);
    const solved = solve(puzzle);
    expect(solved.total).toBe(d.stats.wishes);
    expect(solved.optimum).toBe(d.stats.optimum);
    expect(solved.perfectCount).toBe(d.stats.perfectCount);
    expect(greedyTown(puzzle).score).toBe(d.stats.greedyScore);
    expect(scoreTown(puzzle, d.stats.exampleTown).met).toBe(d.stats.wishes);
    expect(d.stats.roll).toBe(d.postData.roll);
    expect(JSON.stringify(d.postData).length).toBeLessThan(2048);
  });
});
