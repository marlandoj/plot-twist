import { BUILDING_BY_ID } from '../../shared/catalog';
import { addDays, buildCandidate, generateDay, WEEKDAY_NAMES, type DayStats } from '../../shared/generator';
import type { Teaser } from '../../shared/api';
import type { DayPostData, GuestResident, Puzzle } from '../../shared/types';
import { epochDay, keys } from './keys';
import type { Store } from './ports';

export const QUEUE_DAYS = 14;

export type DayRecord = {
  date: string;
  roll: number;
  guest?: GuestResident;
  stats: DayStats;
  postId?: string;
  promptCommentId?: string;
};

const toRecord = (h: Record<string, string>): DayRecord | null => {
  if (!h.date || h.roll === undefined || !h.stats) return null;
  const rec: DayRecord = { date: h.date, roll: Number(h.roll), stats: JSON.parse(h.stats) as DayStats };
  if (h.guest) rec.guest = JSON.parse(h.guest) as GuestResident;
  if (h.postId) rec.postId = h.postId;
  if (h.promptCommentId) rec.promptCommentId = h.promptCommentId;
  return rec;
};

export const readDay = async (store: Store, date: string) => toRecord(await store.hGetAll(keys.day(date)));

export const writeDay = async (store: Store, rec: DayRecord) => {
  const fields: Record<string, string> = {
    date: rec.date,
    roll: String(rec.roll),
    stats: JSON.stringify(rec.stats),
  };
  if (rec.guest) fields.guest = JSON.stringify(rec.guest);
  await store.hSet(keys.day(rec.date), fields);
  await store.zAdd(keys.queue(), { member: rec.date, score: epochDay(rec.date) });
};

/** Generates (and validates through every fairness gate) a day, or returns the cached one. */
export const ensureDay = async (store: Store, date: string): Promise<DayRecord> => {
  const existing = await readDay(store, date);
  if (existing) return existing;
  const { stats } = generateDay(date);
  const rec: DayRecord = { date, roll: stats.roll, stats };
  await writeDay(store, rec);
  return rec;
};

/** Keeps the queue QUEUE_DAYS ahead of `today`. This is how tomorrow's content makes itself. */
export const ensureQueue = async (store: Store, today: string): Promise<DayRecord[]> => {
  const out: DayRecord[] = [];
  for (let i = 0; i < QUEUE_DAYS; i++) out.push(await ensureDay(store, addDays(today, i)));
  return out;
};

export const postDataFor = (rec: DayRecord): DayPostData => {
  const data: DayPostData = { game: 'plot-twist', date: rec.date, roll: rec.roll };
  if (rec.guest) data.guest = rec.guest;
  return data;
};

export const puzzleFromPostData = (data: DayPostData): Puzzle => buildCandidate(data.date, data.roll, data.guest);

export const isDayPostData = (value: unknown): value is DayPostData => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.game === 'plot-twist' && typeof v.date === 'string' && typeof v.roll === 'number';
};

export const teaserFor = (rec: DayRecord): Teaser => {
  const puzzle = buildCandidate(rec.date, rec.roll, rec.guest);
  // Lead with the community guest when there is one; otherwise the first resident.
  const resident = puzzle.residents.find((r) => r.creditedTo) ?? puzzle.residents[0]!;
  const teaser: Teaser = {
    date: rec.date,
    weekday: WEEKDAY_NAMES[puzzle.difficulty]!,
    residentName: resident.name,
    building: puzzle.buildings[resident.home]!,
    look: resident.look,
  };
  if (resident.creditedTo) teaser.creditedTo = resident.creditedTo;
  return teaser;
};

export const dayTitle = (rec: DayRecord) => {
  const puzzle = buildCandidate(rec.date, rec.roll, rec.guest);
  const guest = puzzle.residents.find((r) => r.creditedTo);
  const lead = guest ?? puzzle.residents[0]!;
  const role = BUILDING_BY_ID[puzzle.buildings[lead.home]!].owner;
  return `Plot Twist · ${WEEKDAY_NAMES[puzzle.difficulty]} ${rec.date} · ${lead.name} the ${role} is moving in`;
};
