import type { InitResponse, JourneyEvent, ResultCard } from '../../shared/api';
import { crossedMilestone, flairText, milestoneFor } from '../../shared/flair';
import { addDays } from '../../shared/generator';
import { scoreRound, validateTown, type RoundResult } from '../../shared/scoring';
import { advanceStreak, EMPTY_STREAK, visibleStreak, type StreakState } from '../../shared/streak';
import { resultComment } from '../../shared/textmap';
import type { DayPostData, Placement } from '../../shared/types';
import { ensureDay, puzzleFromPostData, teaserFor } from './days';
import { keys, weekKey } from './keys';
import type { Ports, Store } from './ports';

type AttemptRecord = {
  placement: Placement;
  result: RoundResult;
  streak: number;
  flair: string | null;
  newFlair: boolean;
};

export const readStreak = async (store: Store, user: string): Promise<StreakState> => {
  const h = await store.hGetAll(keys.streak(user));
  if (!h.current) return EMPTY_STREAK;
  return {
    current: Number(h.current),
    best: Number(h.best ?? h.current),
    lastDate: h.lastDate || null,
    perfectStreak: Number(h.perfectStreak ?? 0),
  };
};

const writeStreak = (store: Store, user: string, s: StreakState) =>
  store.hSet(keys.streak(user), {
    current: String(s.current),
    best: String(s.best),
    lastDate: s.lastDate ?? '',
    perfectStreak: String(s.perfectStreak),
  });

/** "Better than X% of players": share of other players with a strictly lower rank. */
export const percentileFor = (rank: number | undefined, players: number) => {
  if (rank === undefined || players <= 1) return 100;
  return Math.round((rank / (players - 1)) * 100);
};

const buildCard = async (ports: Ports, day: DayPostData, user: string | null, attempt: AttemptRecord): Promise<ResultCard> => {
  const { store } = ports;
  const [players, perfect, rank, posted] = await Promise.all([
    store.zCard(keys.leaderboard(day.date)),
    store.get(keys.perfect(day.date)),
    user ? store.zRank(keys.leaderboard(day.date), user) : Promise.resolve(undefined),
    user ? store.get(keys.posted(day.date, user)) : Promise.resolve(undefined),
  ]);
  const tomorrow = await ensureDay(store, addDays(day.date, 1)).then(teaserFor, () => null);
  // Logged-out players are not recorded; they see the recorded crowd's numbers.
  const percentPerfect =
    players > 0 ? Math.round((Number(perfect ?? 0) / players) * 100) : attempt.result.perfect ? 100 : 0;
  return {
    date: day.date,
    placement: attempt.placement,
    result: attempt.result,
    players: Math.max(players, 1),
    percentPerfect,
    percentile: user ? percentileFor(rank, players) : 100,
    streak: attempt.streak,
    flair: attempt.flair,
    newFlair: attempt.newFlair,
    tomorrow,
    posted: Boolean(posted),
  };
};

export const initSession = async (ports: Ports, day: DayPostData, user: string | null): Promise<InitResponse> => {
  const { store, telemetry, now } = ports;
  const journeyId = await telemetry.start().catch(() => null);
  if (journeyId) await telemetry.interaction(journeyId, 'session_start', day.date).catch(() => undefined);
  const [players, streak, raw] = await Promise.all([
    store.zCard(keys.leaderboard(day.date)),
    user ? readStreak(store, user) : Promise.resolve(EMPTY_STREAK),
    user ? store.get(keys.attempt(day.date, user)) : Promise.resolve(undefined),
  ]);
  const card = raw ? await buildCard(ports, day, user, JSON.parse(raw) as AttemptRecord) : null;
  return {
    type: 'init',
    day,
    username: user,
    journeyId,
    streak: visibleStreak(streak, now().toISOString().slice(0, 10)),
    card,
    players,
  };
};

const PROGRESS: Record<Exclude<JourneyEvent, 'session_start'>, number> = {
  first_placement: 0.2,
  town_opened: 0.9,
  result_posted: 1,
};

export const recordEvent = async (ports: Ports, journeyId: string | null, event: JourneyEvent) => {
  if (!journeyId || event === 'session_start') return;
  await ports.telemetry.interaction(journeyId, event, '');
  await ports.telemetry.progress(journeyId, PROGRESS[event], event);
};

export const submitTown = async (
  ports: Ports,
  day: DayPostData,
  user: string | null,
  rawPlacement: unknown,
  timeMs: number,
  journeyId: string | null
): Promise<ResultCard> => {
  const { store, reddit, telemetry } = ports;
  const puzzle = puzzleFromPostData(day);
  // Never trust the client's score: re-validate and re-score the town here.
  const placement = validateTown(puzzle, rawPlacement);

  if (user) {
    const existing = await store.get(keys.attempt(day.date, user));
    if (existing) return buildCard(ports, day, user, JSON.parse(existing) as AttemptRecord);
  }

  const result = scoreRound(puzzle, placement, Number.isFinite(timeMs) ? timeMs : 0);
  let attempt: AttemptRecord = { placement, result, streak: 0, flair: null, newFlair: false };

  if (user) {
    const before = await readStreak(store, user);
    const after = advanceStreak(before, day.date, result.perfect);
    const crossed = crossedMilestone(before.current, after.current);
    const held = milestoneFor(after.current);
    attempt = {
      ...attempt,
      streak: after.current,
      flair: held ? flairText(held) : null,
      newFlair: crossed !== null,
    };
    await store.set(keys.attempt(day.date, user), JSON.stringify(attempt));
    await store.zAdd(keys.leaderboard(day.date), { member: user, score: result.leaderboardScore });
    await writeStreak(store, user, after);
    if (result.perfect) {
      await store.incrBy(keys.perfect(day.date), 1);
      await store.zIncrBy(keys.week(weekKey(day.date)), user, 1);
    }
    if (crossed) {
      await reddit.setUserFlair(user, flairText(crossed), crossed.background).catch((err: unknown) => {
        console.error('flair update failed', err);
      });
    }
  }

  if (journeyId) {
    await telemetry.end(journeyId, true, result.perfect, result.met).catch(() => undefined);
  }
  return buildCard(ports, day, user, attempt);
};

export const postTown = async (ports: Ports, day: DayPostData, user: string | null, postId: string | undefined) => {
  if (!user) return { ok: false, message: 'Log in to post your town.' };
  if (!postId) return { ok: false, message: 'No post to comment on.' };
  const raw = await ports.store.get(keys.attempt(day.date, user));
  if (!raw) return { ok: false, message: 'Lock in a town first.' };
  if (await ports.store.get(keys.posted(day.date, user))) return { ok: true, message: 'Already posted.' };
  const attempt = JSON.parse(raw) as AttemptRecord;
  const body = resultComment(puzzleFromPostData(day), attempt.placement, attempt.result, attempt.streak);
  await ports.reddit.commentAsUser(postId, body);
  await ports.store.set(keys.posted(day.date, user), '1');
  return { ok: true, message: 'Your town is in the comments!' };
};

export const subscribe = async (ports: Ports, user: string | null) => {
  if (!user) return { ok: false, message: 'Log in to subscribe.' };
  await ports.reddit.subscribeUser();
  return { ok: true, message: `Subscribed to r/${ports.reddit.subredditName()}. See you tomorrow!` };
};
