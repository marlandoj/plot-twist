import type { CommentRef, Ports, RedditPort, Store, TelemetryPort, ZMember } from '../../src/server/core/ports';
import type { DayPostData } from '../../src/shared/types';

/** In-memory Redis with the sorted-set semantics the game relies on. */
export class FakeStore implements Store {
  strings = new Map<string, string>();
  hashes = new Map<string, Map<string, string>>();
  zsets = new Map<string, Map<string, number>>();

  async get(k: string) {
    return this.strings.get(k);
  }
  async set(k: string, v: string) {
    this.strings.set(k, v);
  }
  async del(...ks: string[]) {
    for (const k of ks) {
      this.strings.delete(k);
      this.hashes.delete(k);
      this.zsets.delete(k);
    }
  }
  async incrBy(k: string, v: number) {
    const n = Number(this.strings.get(k) ?? 0) + v;
    this.strings.set(k, String(n));
    return n;
  }
  async hGetAll(k: string) {
    return Object.fromEntries(this.hashes.get(k) ?? []);
  }
  async hSet(k: string, f: Record<string, string>) {
    const h = this.hashes.get(k) ?? new Map<string, string>();
    for (const [key, v] of Object.entries(f)) h.set(key, v);
    this.hashes.set(k, h);
  }
  private z(k: string) {
    const z = this.zsets.get(k) ?? new Map<string, number>();
    this.zsets.set(k, z);
    return z;
  }
  private sorted(k: string): ZMember[] {
    return [...this.z(k)].map(([member, score]) => ({ member, score })).sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : 1));
  }
  async zAdd(k: string, ...ms: ZMember[]) {
    for (const m of ms) this.z(k).set(m.member, m.score);
  }
  async zRem(k: string, ms: string[]) {
    for (const m of ms) this.z(k).delete(m);
  }
  async zScore(k: string, m: string) {
    return this.z(k).get(m);
  }
  async zRank(k: string, m: string) {
    const i = this.sorted(k).findIndex((x) => x.member === m);
    return i < 0 ? undefined : i;
  }
  async zCard(k: string) {
    return this.z(k).size;
  }
  async zIncrBy(k: string, m: string, v: number) {
    const n = (this.z(k).get(m) ?? 0) + v;
    this.z(k).set(m, n);
    return n;
  }
  async zRange(k: string, start: number, stop: number, options?: { by: 'rank' | 'score'; reverse?: boolean }) {
    const all = this.sorted(k);
    if (options?.reverse) all.reverse();
    const end = stop < 0 ? all.length + stop : stop;
    return all.slice(start, end + 1);
  }
}

export type Recorded = {
  userComments: { postId: string; text: string }[];
  appComments: { postId: string; text: string; sticky: boolean; id: string }[];
  flairs: { username: string; text: string }[];
  subscribed: number;
  dayPosts: { id: string; title: string; postData: DayPostData }[];
  textPosts: { id: string; title: string; text: string }[];
  journeys: { id: string; events: string[]; ended?: { win: boolean; score: number } }[];
};

export const makePorts = (opts: { now?: Date; replies?: Record<string, CommentRef[]> } = {}) => {
  const store = new FakeStore();
  const rec: Recorded = {
    userComments: [],
    appComments: [],
    flairs: [],
    subscribed: 0,
    dayPosts: [],
    textPosts: [],
    journeys: [],
  };
  let clock = opts.now ?? new Date('2026-11-12T12:00:00Z');
  let ids = 0;
  const reddit: RedditPort = {
    subredditName: () => 'PlotTwistGame',
    commentAsUser: async (postId, text) => {
      rec.userComments.push({ postId, text });
      return { id: `t1_u${++ids}` };
    },
    commentAsApp: async (postId, text, sticky) => {
      const id = `t1_a${++ids}`;
      rec.appComments.push({ postId, text, sticky, id });
      return { id };
    },
    subscribeUser: async () => {
      rec.subscribed++;
    },
    setUserFlair: async (username, text) => {
      rec.flairs.push({ username, text });
    },
    createDayPost: async (title, postData) => {
      const id = `t3_p${++ids}`;
      rec.dayPosts.push({ id, title, postData });
      return { id, url: `https://reddit.com/${id}` };
    },
    createTextPost: async (title, text) => {
      const id = `t3_t${++ids}`;
      rec.textPosts.push({ id, title, text });
      return { id, url: `https://reddit.com/${id}` };
    },
    repliesTo: async (commentId) => opts.replies?.[commentId] ?? [],
  };
  const telemetry: TelemetryPort = {
    start: async () => {
      const id = `journey_${rec.journeys.length + 1}`;
      rec.journeys.push({ id, events: [] });
      return id;
    },
    interaction: async (journeyId, action) => {
      rec.journeys.find((j) => j.id === journeyId)?.events.push(action);
    },
    progress: async () => undefined,
    end: async (journeyId, _complete, win, score) => {
      const j = rec.journeys.find((x) => x.id === journeyId);
      if (j) j.ended = { win, score };
    },
  };
  const ports: Ports = { store, reddit, telemetry, now: () => clock };
  return {
    ports,
    store,
    rec,
    setNow: (d: Date) => {
      clock = d;
    },
  };
};
