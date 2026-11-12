import { BUILDING_BY_ID } from '../../shared/catalog';
import { addDays, generateDay } from '../../shared/generator';
import { parseSuggestion, SUGGESTION_EXAMPLE } from '../../shared/suggestions';
import type { GuestResident } from '../../shared/types';
import { dayTitle, ensureQueue, postDataFor, readDay, writeDay, type DayRecord } from './days';
import { keys, weekKey } from './keys';
import type { Ports, Store } from './ports';

/** A suggestion must become real content within this many days of approval. */
export const GUEST_WINDOW_DAYS = 7;

export type SuggestionStatus = 'pending' | 'approved' | 'scheduled' | 'rejected';

export type Suggestion = {
  id: string;
  author: string;
  body: string;
  votes: number;
  status: SuggestionStatus;
  guest: GuestResident;
  scheduledFor?: string;
};

export const PROMPT_TEXT = [
  '**Who should move in tomorrow?** 🏡',
  '',
  'Reply with a resident and up to two wishes. The top-voted reply that fits the format moves in within a week, credited to you.',
  '',
  `> ${SUGGESTION_EXAMPLE}`,
  '',
  'Wishes the town understands: next to, away from, far from, corner, edge, middle of town, same street, same column, north of, beside a landmark, no neighbours, Main Street.',
].join('\n');

export const HELP_TEXT = [
  '**Help thread** 🧭 Stuck on a resident? Ask here.',
  '',
  'Please wrap answers in spoiler tags: `>!like this!<`',
].join('\n');

const readSuggestion = async (store: Store, id: string): Promise<Suggestion | null> => {
  const raw = await store.get(keys.suggestion(id));
  return raw ? (JSON.parse(raw) as Suggestion) : null;
};
const writeSuggestion = (store: Store, s: Suggestion) => store.set(keys.suggestion(s.id), JSON.stringify(s));

/** Intake: read replies to a day's pinned prompt, keep the ones that fit the wish grammar. */
export const ingestSuggestions = async (ports: Ports, promptCommentId: string) => {
  const replies = await ports.reddit.repliesTo(promptCommentId);
  let accepted = 0;
  let rejected = 0;
  for (const reply of replies) {
    const parsed = parseSuggestion(reply.body);
    if (!parsed.ok) {
      rejected++;
      continue;
    }
    const id = `c_${reply.id}`;
    const existing = await readSuggestion(ports.store, id);
    const s: Suggestion = existing
      ? { ...existing, votes: reply.score }
      : {
          id,
          author: reply.authorName,
          body: reply.body,
          votes: reply.score,
          status: 'pending',
          guest: { ...parsed.guest, id, creditedTo: reply.authorName },
        };
    await writeSuggestion(ports.store, s);
    if (s.status === 'pending') await ports.store.zAdd(keys.pending(), { member: id, score: s.votes });
    accepted++;
  }
  return { accepted, rejected };
};

/** Curation queue, top-voted first. */
export const pendingSuggestions = async (store: Store, limit = 10): Promise<Suggestion[]> => {
  const ids = await store.zRange(keys.pending(), 0, limit - 1, { by: 'rank', reverse: true });
  const out: Suggestion[] = [];
  for (const { member } of ids) {
    const s = await readSuggestion(store, member);
    if (s) out.push(s);
  }
  return out;
};

/**
 * Operator approval. The guest is scheduled into the first day in the next
 * GUEST_WINDOW_DAYS that has no guest and no post yet, and that day is
 * regenerated with the guest through the same fairness gates.
 */
export const approveSuggestion = async (ports: Ports, id: string, today: string): Promise<Suggestion> => {
  const s = await readSuggestion(ports.store, id);
  if (!s) throw new Error(`No suggestion ${id}`);
  await ports.store.zRem(keys.pending(), [id]);
  s.status = 'approved';
  for (let i = 1; i <= GUEST_WINDOW_DAYS; i++) {
    const date = addDays(today, i);
    const current = await readDay(ports.store, date);
    if (current?.guest || current?.postId) continue;
    try {
      const { stats } = generateDay(date, s.guest);
      const rec: DayRecord = { date, roll: stats.roll, guest: s.guest, stats };
      await writeDay(ports.store, rec);
      s.status = 'scheduled';
      s.scheduledFor = date;
      break;
    } catch {
      // This date cannot host the guest fairly; try the next one.
    }
  }
  if (s.status === 'approved') {
    await ports.store.zAdd(keys.approved(), { member: id, score: ports.now().getTime() });
  }
  await writeSuggestion(ports.store, s);
  return s;
};

export const rejectSuggestion = async (store: Store, id: string) => {
  const s = await readSuggestion(store, id);
  if (!s) return;
  s.status = 'rejected';
  await store.zRem(keys.pending(), [id]);
  await writeSuggestion(store, s);
};

/** Retries approved-but-unscheduled guests (e.g. after a busy week). */
const scheduleApproved = async (ports: Ports, today: string) => {
  const waiting = await ports.store.zRange(keys.approved(), 0, -1, { by: 'rank' });
  for (const { member } of waiting) {
    const s = await approveSuggestion(ports, member, today);
    if (s.status === 'scheduled') await ports.store.zRem(keys.approved(), [member]);
  }
};

/** Creates today's post with its pinned prompt and help thread, if not done yet. */
export const publishDay = async (ports: Ports, date: string): Promise<DayRecord> => {
  const rec = (await readDay(ports.store, date)) ?? (await ensureQueue(ports.store, date))[0]!;
  if (rec.postId) return rec;
  const post = await ports.reddit.createDayPost(dayTitle(rec), postDataFor(rec));
  const prompt = await ports.reddit.commentAsApp(post.id, PROMPT_TEXT, true);
  await ports.reddit.commentAsApp(post.id, HELP_TEXT, false);
  await ports.store.hSet(keys.day(date), { postId: post.id, promptCommentId: prompt.id });
  return { ...rec, postId: post.id, promptCommentId: prompt.id };
};

/** Scheduler job, daily at 00:00 UTC. */
export const dailyRollover = async (ports: Ports, today: string) => {
  await ensureQueue(ports.store, today);
  const yesterday = await readDay(ports.store, addDays(today, -1));
  const intake = yesterday?.promptCommentId
    ? await ingestSuggestions(ports, yesterday.promptCommentId)
    : { accepted: 0, rejected: 0 };
  await scheduleApproved(ports, today);
  const rec = await publishDay(ports, today);
  return { date: today, postId: rec.postId, intake };
};

/** Scheduler job, Mondays: names last week's perfect-town builders. */
export const mayorsWall = async (ports: Ports, today: string) => {
  const lastWeek = weekKey(addDays(today, -7));
  const top = await ports.store.zRange(keys.week(lastWeek), 0, 24, { by: 'rank', reverse: true });
  const lines = top.length
    ? top.map((m, i) => `${i + 1}. u/${m.member} · ${'🏡'.repeat(Math.min(m.score, 7))} ${m.score} perfect town${m.score === 1 ? '' : 's'}`)
    : ['Nobody built a perfect town last week. The ribbon is still uncut. ✂️'];
  const title = `Mayors Wall · ${lastWeek} · ${top.length} perfect-town builder${top.length === 1 ? '' : 's'}`;
  const text = [
    `**The Mayors Wall for ${lastWeek}** 🏛️`,
    '',
    'Every player who built a town that granted every wish:',
    '',
    ...lines,
    '',
    'New streets every day at 00:00 UTC.',
  ].join('\n');
  const post = await ports.reddit.createTextPost(title, text);
  return { week: lastWeek, builders: top.length, postId: post.id };
};

export const describeGuest = (g: GuestResident) =>
  `${g.name} the ${BUILDING_BY_ID[g.building].owner} (u/${g.creditedTo})`;
