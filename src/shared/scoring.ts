import { CELLS } from './grid';
import { scoreTown } from './rules';
import type { Placement, Puzzle } from './types';

export type Grade = 'Perfect Town' | 'A' | 'B' | 'C' | 'D';

export type RoundResult = {
  met: number;
  total: number;
  percent: number;
  grade: Grade;
  perfect: boolean;
  timeMs: number;
  /** Sorted-set score: more wishes first, then faster. Higher is better. */
  leaderboardScore: number;
};

export const gradeFor = (met: number, total: number): Grade => {
  if (total > 0 && met === total) return 'Perfect Town';
  const pct = total > 0 ? met / total : 0;
  if (pct >= 0.85) return 'A';
  if (pct >= 0.7) return 'B';
  if (pct >= 0.5) return 'C';
  return 'D';
};

/** Time is capped at 1 hour so the composite score stays an exact integer. */
export const MAX_TIME_MS = 3_600_000;

export const leaderboardScore = (met: number, timeMs: number) =>
  met * (MAX_TIME_MS + 1) + (MAX_TIME_MS - Math.min(Math.max(0, Math.round(timeMs)), MAX_TIME_MS));

export class InvalidTownError extends Error {}

/** Server-side validation: a locked-in town must place all 5 buildings on distinct free lots. */
export const validateTown = (puzzle: Puzzle, placement: unknown): Placement => {
  if (!Array.isArray(placement) || placement.length !== puzzle.buildings.length) {
    throw new InvalidTownError('town must place every building');
  }
  const blocked = new Set(puzzle.landmarks.map((l) => l.cell));
  const seen = new Set<number>();
  for (const cell of placement) {
    if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= CELLS) {
      throw new InvalidTownError('lot out of range');
    }
    if (blocked.has(cell)) throw new InvalidTownError('lot is a landmark');
    if (seen.has(cell)) throw new InvalidTownError('two buildings on one lot');
    seen.add(cell);
  }
  return placement as number[];
};

export const scoreRound = (puzzle: Puzzle, placement: Placement, timeMs: number): RoundResult => {
  const s = scoreTown(puzzle, placement);
  const grade = gradeFor(s.met, s.total);
  return {
    met: s.met,
    total: s.total,
    percent: s.total ? Math.round((s.met / s.total) * 100) : 0,
    grade,
    perfect: grade === 'Perfect Town',
    timeMs: Math.round(timeMs),
    leaderboardScore: leaderboardScore(s.met, timeMs),
  };
};

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
