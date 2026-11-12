import { describe, expect, it } from 'vitest';
import { crossedMilestone, flairText, milestoneFor, nextMilestone } from '../src/shared/flair';
import { buildCandidate } from '../src/shared/generator';
import {
  formatTime,
  gradeFor,
  InvalidTownError,
  leaderboardScore,
  scoreRound,
  validateTown,
} from '../src/shared/scoring';
import { advanceStreak, EMPTY_STREAK, visibleStreak } from '../src/shared/streak';
import { townEmojiRows, resultComment } from '../src/shared/textmap';
import { solve } from '../src/shared/solver';

describe('grades', () => {
  it('maps wishes granted to a grade', () => {
    expect(gradeFor(8, 8)).toBe('Perfect Town');
    expect(gradeFor(7, 8)).toBe('A');
    expect(gradeFor(6, 8)).toBe('B');
    expect(gradeFor(4, 8)).toBe('C');
    expect(gradeFor(3, 8)).toBe('D');
  });

  it('leaderboard ranks more wishes first, then faster times', () => {
    expect(leaderboardScore(7, 600_000)).toBeGreaterThan(leaderboardScore(6, 1_000));
    expect(leaderboardScore(6, 30_000)).toBeGreaterThan(leaderboardScore(6, 90_000));
    expect(Number.isSafeInteger(leaderboardScore(10, 0))).toBe(true);
  });

  it('formats time', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(161_400)).toBe('2:41');
  });

  it('validates a locked-in town on the server', () => {
    const p = buildCandidate('2026-11-12', 20);
    const mark = p.landmarks[0]!.cell;
    const free = [...Array(24).keys()].filter((c) => !p.landmarks.some((l) => l.cell === c));
    expect(() => validateTown(p, free.slice(0, 4))).toThrow(InvalidTownError);
    expect(() => validateTown(p, [mark, ...free.slice(0, 4)])).toThrow(/landmark/);
    expect(() => validateTown(p, [free[0], free[0], free[1], free[2], free[3]])).toThrow(/two buildings/);
    expect(() => validateTown(p, [99, ...free.slice(0, 4)])).toThrow(/range/);
    expect(() => validateTown(p, 'nope')).toThrow(InvalidTownError);
    expect(validateTown(p, free.slice(0, 5))).toEqual(free.slice(0, 5));
  });

  it('scores the solver town as Perfect', () => {
    const p = buildCandidate('2026-11-12', 20);
    const r = scoreRound(p, solve(p).example, 95_000);
    expect(r.perfect).toBe(true);
    expect(r.grade).toBe('Perfect Town');
    expect(r.percent).toBe(100);
  });
});

describe('streaks', () => {
  it('counts consecutive UTC days, ignores replays, resets after a gap', () => {
    let s = advanceStreak(EMPTY_STREAK, '2026-11-12', true);
    expect(s).toMatchObject({ current: 1, best: 1, perfectStreak: 1 });
    expect(advanceStreak(s, '2026-11-12', false)).toBe(s);
    s = advanceStreak(s, '2026-11-13', false);
    expect(s).toMatchObject({ current: 2, perfectStreak: 0 });
    s = advanceStreak(s, '2026-11-14', true);
    expect(s.current).toBe(3);
    s = advanceStreak(s, '2026-11-16', true);
    expect(s).toMatchObject({ current: 1, best: 3, perfectStreak: 1 });
  });

  it('crosses month and year boundaries', () => {
    const s = advanceStreak(advanceStreak(EMPTY_STREAK, '2026-12-31', false), '2027-01-01', false);
    expect(s.current).toBe(2);
  });

  it('shows a broken streak as 0 before the player plays again', () => {
    const s = advanceStreak(EMPTY_STREAK, '2026-11-12', false);
    expect(visibleStreak(s, '2026-11-12')).toBe(1);
    expect(visibleStreak(s, '2026-11-13')).toBe(1);
    expect(visibleStreak(s, '2026-11-14')).toBe(0);
  });
});

describe('flair milestones', () => {
  it('awards titles at 3, 7, 14, 30 and 100 days', () => {
    expect(milestoneFor(2)).toBeNull();
    expect(flairText(milestoneFor(3)!)).toBe('Resident, 3-day streak');
    expect(flairText(milestoneFor(7)!)).toBe('Mayor, 7-day streak');
    expect(milestoneFor(13)!.title).toBe('Mayor');
    expect(milestoneFor(14)!.title).toBe('Town Planner');
    expect(milestoneFor(30)!.title).toBe('City Founder');
    expect(milestoneFor(365)!.title).toBe('Plot Legend');
  });
  it('only fires when a milestone is crossed', () => {
    expect(crossedMilestone(6, 7)!.title).toBe('Mayor');
    expect(crossedMilestone(7, 8)).toBeNull();
    expect(crossedMilestone(1, 2)).toBeNull();
    expect(nextMilestone(7)!.days).toBe(14);
  });
});

describe('text-and-emoji town map (comment fallback)', () => {
  const p = buildCandidate('2026-11-12', 20);
  const town = solve(p).example;

  it('is 4 rows of 6 symbols so it reads at 300px wide', () => {
    const rows = townEmojiRows(p, town);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect([...new Intl.Segmenter().segment(r)]).toHaveLength(6);
  });

  it('puts grade, wishes, time and streak in the comment', () => {
    const body = resultComment(p, town, scoreRound(p, town, 161_400), 7);
    expect(body).toContain('Plot Twist 2026-11-12');
    expect(body).toContain('Perfect Town');
    expect(body).toContain('7/7 wishes');
    expect(body).toContain('2:41');
    expect(body).toContain('🔥7');
    expect(body).not.toContain('```');
  });
});
