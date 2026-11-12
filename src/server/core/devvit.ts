import { context, reddit, redis } from '@devvit/web/server';
import { telemetry } from '@devvit/analytics/server/reddit';
import type { JsonObject } from '@devvit/web/shared';
import type { DayPostData } from '../../shared/types';
import type { Ports, RedditPort, Store, TelemetryPort } from './ports';

type T1 = `t1_${string}`;
type T3 = `t3_${string}`;

/** postData must be plain JSON; spell the shape out instead of casting. */
const toJson = (d: DayPostData): JsonObject => {
  const out: JsonObject = { game: d.game, date: d.date, roll: d.roll };
  if (d.guest) {
    out.guest = {
      id: d.guest.id,
      name: d.guest.name,
      building: d.guest.building,
      creditedTo: d.guest.creditedTo,
      wishes: d.guest.wishes.map((w) => {
        const wish: JsonObject = { type: w.type };
        if (w.other) wish.other = w.other;
        if (w.landmark) wish.landmark = w.landmark;
        return wish;
      }),
    };
  }
  return out;
};

const store: Store = {
  get: (k) => redis.get(k),
  set: (k, v) => redis.set(k, v),
  del: (...k) => redis.del(...k),
  incrBy: (k, v) => redis.incrBy(k, v),
  hGetAll: (k) => redis.hGetAll(k),
  hSet: (k, f) => redis.hSet(k, f),
  zAdd: (k, ...m) => redis.zAdd(k, ...m),
  zRem: (k, m) => redis.zRem(k, m),
  zScore: (k, m) => redis.zScore(k, m),
  zRank: (k, m) => redis.zRank(k, m),
  zCard: (k) => redis.zCard(k),
  zIncrBy: (k, m, v) => redis.zIncrBy(k, m, v),
  zRange: (k, start, stop, options) => redis.zRange(k, start, stop, options),
};

const redditPort: RedditPort = {
  subredditName: () => context.subredditName ?? '',
  commentAsUser: async (postId, text) => {
    const c = await reddit.submitComment({ id: postId as T3, text, runAs: 'USER' });
    return { id: c.id };
  },
  commentAsApp: async (postId, text, sticky) => {
    const c = await reddit.submitComment({ id: postId as T3, text, runAs: 'APP' });
    if (sticky) await c.distinguish(true);
    return { id: c.id };
  },
  subscribeUser: () => reddit.subscribeToCurrentSubreddit(),
  setUserFlair: (username, text, backgroundColor) =>
    reddit.setUserFlair({
      subredditName: context.subredditName ?? '',
      username,
      text,
      backgroundColor,
      textColor: 'light',
    }),
  createDayPost: async (title, postData) => {
    const post = await reddit.submitCustomPost({
      title,
      postData: toJson(postData),
      textFallback: { text: 'Plot Twist is a daily tiny-town puzzle. Open this post on new Reddit or the app to play.' },
    });
    return { id: post.id, url: post.url };
  },
  createTextPost: async (title, text) => {
    const post = await reddit.submitPost({ subredditName: context.subredditName ?? '', title, text });
    return { id: post.id, url: post.url };
  },
  repliesTo: async (commentId) => {
    const parent = await reddit.getCommentById(commentId as T1);
    const replies = await parent.replies.all();
    return replies.map((r) => ({ id: r.id, authorName: r.authorName, body: r.body, score: r.score }));
  },
};

const telemetryPort: TelemetryPort = {
  start: async () => (await telemetry.startJourney()).journeyId,
  interaction: async (journeyId, action, actionDetails) => {
    await telemetry.journeyInteraction({ journeyId, action, actionDetails });
  },
  progress: async (journeyId, progress, action) => {
    await telemetry.journeyProgress({ journeyId, progress, action });
  },
  end: async (journeyId, complete, win, score) => {
    await telemetry.endJourney({ journeyId, complete, game: { win, score } });
  },
};

export const devvitPorts: Ports = { store, reddit: redditPort, telemetry: telemetryPort, now: () => new Date() };
