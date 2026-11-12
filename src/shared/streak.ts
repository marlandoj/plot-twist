import { addDays } from './generator';

export type StreakState = {
  current: number;
  best: number;
  /** Last UTC date (YYYY-MM-DD) the player locked in a town. */
  lastDate: string | null;
  perfectStreak: number;
};

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, lastDate: null, perfectStreak: 0 };

/**
 * Streak counts consecutive UTC days with a locked-in town (any grade).
 * Playing twice on one day is a no-op; missing a day resets to 1.
 */
export const advanceStreak = (prev: StreakState, date: string, perfect: boolean): StreakState => {
  if (prev.lastDate === date) return prev;
  const continues = prev.lastDate !== null && addDays(prev.lastDate, 1) === date;
  const current = continues ? prev.current + 1 : 1;
  const perfectStreak = perfect ? (continues ? prev.perfectStreak + 1 : 1) : 0;
  return { current, best: Math.max(prev.best, current), lastDate: date, perfectStreak };
};

/** What the streak shows today without playing (a gap of 2+ days means it is broken). */
export const visibleStreak = (s: StreakState, today: string): number => {
  if (!s.lastDate) return 0;
  if (s.lastDate === today || addDays(s.lastDate, 1) === today) return s.current;
  return 0;
};
