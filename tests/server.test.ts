import { describe, expect, it } from 'vitest';
import {
  approveSuggestion,
  dailyRollover,
  GUEST_WINDOW_DAYS,
  mayorsWall,
  pendingSuggestions,
  PROMPT_TEXT,
  rejectSuggestion,
} from '../src/server/core/community';
import { ensureDay, ensureQueue, postDataFor, puzzleFromPostData, readDay } from '../src/server/core/days';
import { initSession, percentileFor, postTown, recordEvent, submitTown, subscribe } from '../src/server/core/game';
import { keys, weekKey } from '../src/server/core/keys';
import { addDays } from '../src/shared/generator';
import { InvalidTownError } from '../src/shared/scoring';
import { solve } from '../src/shared/solver';
import type { DayPostData, Placement, Puzzle } from '../src/shared/types';
import { makePorts } from './support/fakes';

const DATE = '2026-11-12';

const setup = async (date = DATE) => {
  const env = makePorts({ now: new Date(`${date}T12:00:00Z`) });
  const rec = await ensureDay(env.store, date);
  const day = postDataFor(rec);
  const puzzle = puzzleFromPostData(day);
  return { ...env, day, puzzle };
};

/** A legal but imperfect town: the first five free lots in order. */
const firstFree = (p: Puzzle): Placement =>
  [...Array(24).keys()].filter((c) => !p.landmarks.some((l) => l.cell === c)).slice(0, 5);

describe('session, attempts and leaderboard', () => {
  it('init starts a Journey with session_start and reports no attempt yet', async () => {
    const { ports, rec, day } = await setup();
    const init = await initSession(ports, day, 'alice');
    expect(init.journeyId).toBe('journey_1');
    expect(rec.journeys[0]!.events).toEqual(['session_start']);
    expect(init.card).toBeNull();
    expect(init.day).toEqual(day);
  });

  it('records first_placement, town_opened and result_posted on the journey', async () => {
    const { ports, rec, day } = await setup();
    const { journeyId } = await initSession(ports, day, 'alice');
    await recordEvent(ports, journeyId, 'first_placement');
    await recordEvent(ports, journeyId, 'town_opened');
    await recordEvent(ports, journeyId, 'result_posted');
    expect(rec.journeys[0]!.events).toEqual(['session_start', 'first_placement', 'town_opened', 'result_posted']);
  });

  it('scores on the server, stores the attempt, ranks players and counts perfect towns', async () => {
    const { ports, store, rec, day, puzzle } = await setup();
    const perfect = solve(puzzle).example;
    const { journeyId } = await initSession(ports, day, 'alice');
    const a = await submitTown(ports, day, 'alice', perfect, 120_000, journeyId);
    expect(a.result.perfect).toBe(true);
    expect(rec.journeys[0]!.ended).toEqual({ win: true, score: a.result.total });
    const b = await submitTown(ports, day, 'bob', firstFree(puzzle), 60_000, null);
    const c = await submitTown(ports, day, 'cara', perfect, 200_000, null);
    expect(b.result.perfect).toBe(false);
    expect(await store.zCard(keys.leaderboard(DATE))).toBe(3);
    expect(c.players).toBe(3);
    expect(c.percentPerfect).toBe(67);
    // alice: perfect and faster than cara => top
    const again = await initSession(ports, day, 'alice');
    expect(again.card!.percentile).toBe(100);
    expect(c.percentile).toBe(50);
    expect(b.percentile).toBe(0);
    expect(a.tomorrow?.date).toBe(addDays(DATE, 1));
  });

  it('one attempt per day: a second lock-in returns the first result', async () => {
    const { ports, day, puzzle } = await setup();
    const first = await submitTown(ports, day, 'alice', firstFree(puzzle), 50_000, null);
    const second = await submitTown(ports, day, 'alice', solve(puzzle).example, 10_000, null);
    expect(second.result).toEqual(first.result);
  });

  it('rejects illegal towns', async () => {
    const { ports, day, puzzle } = await setup();
    await expect(submitTown(ports, day, 'alice', [puzzle.landmarks[0]!.cell, 0, 1, 2, 3], 1, null)).rejects.toThrow(
      InvalidTownError
    );
  });

  it('logged-out players can play but nothing is stored', async () => {
    const { ports, store, day, puzzle } = await setup();
    const card = await submitTown(ports, day, null, firstFree(puzzle), 1000, null);
    expect(card.streak).toBe(0);
    expect(await store.zCard(keys.leaderboard(DATE))).toBe(0);
  });

  it('percentile helper', () => {
    expect(percentileFor(undefined, 0)).toBe(100);
    expect(percentileFor(0, 1)).toBe(100);
    expect(percentileFor(0, 5)).toBe(0);
    expect(percentileFor(4, 5)).toBe(100);
  });
});

describe('streaks and flair across days', () => {
  it('builds a streak and sets "Resident, 3-day streak" flair exactly once', async () => {
    const env = makePorts();
    for (let i = 0; i < 4; i++) {
      const date = addDays(DATE, i);
      env.setNow(new Date(`${date}T08:00:00Z`));
      const day = postDataFor(await ensureDay(env.store, date));
      const card = await submitTown(env.ports, day, 'alice', firstFree(puzzleFromPostData(day)), 1000, null);
      expect(card.streak).toBe(i + 1);
      if (i === 2) expect(card).toMatchObject({ newFlair: true, flair: 'Resident, 3-day streak' });
      if (i === 3) expect(card).toMatchObject({ newFlair: false, flair: 'Resident, 3-day streak' });
    }
    expect(env.rec.flairs).toEqual([{ username: 'alice', text: 'Resident, 3-day streak' }]);
  });

  it('a missed day resets the streak', async () => {
    const env = makePorts();
    for (const date of [DATE, addDays(DATE, 1), addDays(DATE, 3)]) {
      const day = postDataFor(await ensureDay(env.store, date));
      const card = await submitTown(env.ports, day, 'bob', firstFree(puzzleFromPostData(day)), 1000, null);
      if (date === addDays(DATE, 3)) expect(card.streak).toBe(1);
    }
  });
});

describe('result card actions', () => {
  it('Post my town comments the text-and-emoji map once, as the user', async () => {
    const { ports, rec, day, puzzle } = await setup();
    expect((await postTown(ports, day, 'alice', 't3_x')).ok).toBe(false); // must lock in first
    await submitTown(ports, day, 'alice', solve(puzzle).example, 99_000, null);
    expect((await postTown(ports, day, 'alice', 't3_x')).ok).toBe(true);
    await postTown(ports, day, 'alice', 't3_x');
    expect(rec.userComments).toHaveLength(1);
    expect(rec.userComments[0]!.text).toContain('Perfect Town');
    expect(rec.userComments[0]!.text.split('\n').filter((l) => l.endsWith('  '))).toHaveLength(4);
    const init = await initSession(ports, day, 'alice');
    expect(init.card!.posted).toBe(true);
  });

  it('Subscribe subscribes the logged-in user', async () => {
    const { ports, rec } = await setup();
    expect((await subscribe(ports, null)).ok).toBe(false);
    expect((await subscribe(ports, 'alice')).ok).toBe(true);
    expect(rec.subscribed).toBe(1);
  });
});

describe('scheduler: daily rollover, community residents, Mayors Wall', () => {
  it('keeps a 14-day validated queue and posts today with postData, pinned prompt and help thread', async () => {
    const env = makePorts();
    const res = await dailyRollover(env.ports, DATE);
    const queued = await env.store.zRange(keys.queue(), 0, -1, { by: 'rank' });
    expect(queued.map((q) => q.member)).toHaveLength(14);
    for (const q of queued) expect(Object.values((await readDay(env.store, q.member))!.stats.gates).every(Boolean)).toBe(true);
    expect(env.rec.dayPosts).toHaveLength(1);
    const post = env.rec.dayPosts[0]!;
    expect(post.postData).toMatchObject({ game: 'plot-twist', date: DATE });
    expect(res.postId).toBe(post.id);
    expect(env.rec.appComments.map((c) => c.sticky)).toEqual([true, false]);
    expect(env.rec.appComments[0]!.text).toBe(PROMPT_TEXT);
    // Running it again the same day does not double-post.
    await dailyRollover(env.ports, DATE);
    expect(env.rec.dayPosts).toHaveLength(1);
  });

  it('turns top-voted prompt replies into a credited resident within 7 days', async () => {
    const env = makePorts({
      replies: {
        t1_a2: [
          { id: 't1_r1', authorName: 'mapmaker', body: 'Marta the florist: Put my florist on a corner. Keep the nightclub away from my door.', score: 41 },
          { id: 't1_r2', authorName: 'troll', body: 'make it about karma lol', score: 90 },
          { id: 't1_r3', authorName: 'baker_fan', body: 'Gus the baker: Main Street or nothing!', score: 12 },
        ],
      },
    });
    await dailyRollover(env.ports, DATE); // posts DATE; prompt comment id is t1_a2
    expect((await readDay(env.store, DATE))!.promptCommentId).toBe('t1_a2');
    const next = addDays(DATE, 1);
    const res = await dailyRollover(env.ports, next);
    expect(res.intake).toEqual({ accepted: 2, rejected: 1 });

    const queue = await pendingSuggestions(env.store);
    expect(queue.map((s) => s.author)).toEqual(['mapmaker', 'baker_fan']); // top-voted first

    const approved = await approveSuggestion(env.ports, queue[0]!.id, next);
    expect(approved.status).toBe('scheduled');
    const gap = (Date.parse(approved.scheduledFor!) - Date.parse(next)) / 86400000;
    expect(gap).toBeGreaterThanOrEqual(1);
    expect(gap).toBeLessThanOrEqual(GUEST_WINDOW_DAYS);

    const day = (await readDay(env.store, approved.scheduledFor!))!;
    expect(Object.values(day.stats.gates).every(Boolean)).toBe(true);
    const puzzle = puzzleFromPostData(postDataFor(day) as DayPostData);
    const marta = puzzle.residents.find((r) => r.creditedTo === 'mapmaker')!;
    expect(marta.name).toBe('Marta');

    await rejectSuggestion(env.store, queue[1]!.id);
    expect(await pendingSuggestions(env.store)).toHaveLength(0);
  });

  it('Mayors Wall names last week’s perfect-town builders', async () => {
    const env = makePorts();
    const lastWeek = weekKey('2026-11-12');
    await env.store.zIncrBy(keys.week(lastWeek), 'alice', 3);
    await env.store.zIncrBy(keys.week(lastWeek), 'bob', 1);
    const res = await mayorsWall(env.ports, '2026-11-16');
    expect(res).toMatchObject({ week: '2026-W46', builders: 2 });
    const post = env.rec.textPosts[0]!;
    expect(post.title).toContain('Mayors Wall');
    expect(post.text.indexOf('u/alice')).toBeLessThan(post.text.indexOf('u/bob'));
  });

  it('week keys follow ISO weeks', () => {
    expect(weekKey('2026-11-16')).toBe('2026-W47');
    expect(weekKey('2026-11-22')).toBe('2026-W47');
    expect(weekKey('2027-01-01')).toBe('2026-W53');
  });

  it('ensureQueue is idempotent', async () => {
    const env = makePorts();
    const a = await ensureQueue(env.store, DATE);
    const b = await ensureQueue(env.store, DATE);
    expect(b).toEqual(a);
  });
});
