import type { DayPostData } from '../../shared/types';

/**
 * The narrow slice of Devvit's server SDK the game logic uses. Production wires these
 * to `redis`, `reddit` and `telemetry` from @devvit; tests wire in-memory fakes.
 */

export type ZMember = { member: string; score: number };

export type Store = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  incrBy(key: string, value: number): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hSet(key: string, fields: Record<string, string>): Promise<unknown>;
  zAdd(key: string, ...members: ZMember[]): Promise<unknown>;
  zRem(key: string, members: string[]): Promise<unknown>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zRank(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
  zIncrBy(key: string, member: string, value: number): Promise<number>;
  zRange(
    key: string,
    start: number,
    stop: number,
    options?: { by: 'rank' | 'score'; reverse?: boolean }
  ): Promise<ZMember[]>;
};

export type CommentRef = { id: string; authorName: string; body: string; score: number };

export type RedditPort = {
  subredditName(): string;
  /** Runs as the player (needs the SUBMIT_COMMENT user scope). */
  commentAsUser(postId: string, text: string): Promise<{ id: string }>;
  /** Runs as the app account. */
  commentAsApp(postId: string, text: string, sticky: boolean): Promise<{ id: string }>;
  subscribeUser(): Promise<void>;
  setUserFlair(username: string, text: string, backgroundColor: string): Promise<void>;
  createDayPost(title: string, postData: DayPostData): Promise<{ id: string; url: string }>;
  createTextPost(title: string, text: string): Promise<{ id: string; url: string }>;
  repliesTo(commentId: string): Promise<CommentRef[]>;
};

export type TelemetryPort = {
  start(): Promise<string | null>;
  interaction(journeyId: string, action: string, details: string): Promise<void>;
  progress(journeyId: string, progress: number, action: string): Promise<void>;
  end(journeyId: string, complete: boolean, win: boolean, score: number): Promise<void>;
};

export type Ports = { store: Store; reddit: RedditPort; telemetry: TelemetryPort; now: () => Date };
