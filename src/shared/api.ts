import type { BuildingId } from './catalog';
import type { RoundResult } from './scoring';
import type { DayPostData, Placement, ResidentLook } from './types';

export type JourneyEvent = 'session_start' | 'first_placement' | 'town_opened' | 'result_posted';

export type Teaser = {
  date: string;
  weekday: string;
  residentName: string;
  building: BuildingId;
  look: ResidentLook;
  creditedTo?: string;
};

export type ResultCard = {
  date: string;
  placement: Placement;
  result: RoundResult;
  players: number;
  /** Share of today's players who found a perfect town, 0-100. */
  percentPerfect: number;
  /** "Better than X% of players", 0-100. */
  percentile: number;
  streak: number;
  flair: string | null;
  newFlair: boolean;
  tomorrow: Teaser | null;
  posted: boolean;
};

export type InitResponse = {
  type: 'init';
  day: DayPostData;
  username: string | null;
  journeyId: string | null;
  streak: number;
  /** Present when this player already locked in today. One attempt per day. */
  card: ResultCard | null;
  players: number;
};

export type SubmitRequest = { date: string; placement: Placement; timeMs: number; journeyId: string | null };
export type SubmitResponse = { type: 'submit'; card: ResultCard };

export type EventRequest = { journeyId: string | null; event: JourneyEvent };

export type PostTownResponse = { type: 'post-town'; ok: boolean; message: string };
export type SubscribeResponse = { type: 'subscribe'; ok: boolean; message: string };

export type ErrorResponse = { status: 'error'; message: string };
