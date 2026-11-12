/**
 * Standalone web preview for plottwist.zouroboros.ai — NOT part of the Devvit app.
 *
 * Runs the game's real core logic (init / submit / events / post-town / subscribe)
 * against in-memory ports, so Marlando can view and playtest the exact client that
 * ships to Reddit before the Devvit upload. Differences from production on Reddit:
 * - the "day" is generated for the current UTC date, same generator + fairness gates;
 * - each visitor gets a guest identity by cookie, so streaks and the leaderboard work
 *   per browser, but all state is in memory and resets when this process restarts;
 * - Post my town / Subscribe succeed locally (recorded, not sent to Reddit);
 * - Journeys telemetry is a no-op recorder.
 *
 * Run: npm run build && PORT=56820 npm run preview
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCookie, setCookie } from 'hono/cookie';
import { readFile } from 'node:fs/promises';
import type {
  ErrorResponse,
  EventRequest,
  InitResponse,
  PostTownResponse,
  SubmitRequest,
  SubmitResponse,
  SubscribeResponse,
} from '../src/shared/api';
import { InvalidTownError } from '../src/shared/scoring';
import { FakeStore } from '../tests/support/fakes';
import type { Ports, RedditPort, TelemetryPort } from '../src/server/core/ports';
import { ensureDay, postDataFor } from '../src/server/core/days';
import { initSession, postTown, recordEvent, submitTown, subscribe } from '../src/server/core/game';

const store = new FakeStore();

const reddit: RedditPort = {
  subredditName: () => 'PlotTwistGame',
  commentAsUser: async () => ({ id: 'preview-comment' }),
  commentAsApp: async () => ({ id: 'preview-comment' }),
  subscribeUser: async () => undefined,
  setUserFlair: async () => undefined,
  createDayPost: async () => ({ id: 'preview-post', url: '/' }),
  createTextPost: async () => ({ id: 'preview-post', url: '/' }),
  repliesTo: async () => [],
};

const journeys = new Map<string, string[]>();
let journeySeq = 0;
const telemetry: TelemetryPort = {
  start: async () => {
    const id = `preview_journey_${++journeySeq}`;
    journeys.set(id, []);
    return id;
  },
  interaction: async (journeyId, action) => {
    journeys.get(journeyId)?.push(action);
  },
  progress: async () => undefined,
  end: async () => undefined,
};

const ports: Ports = { store, reddit, telemetry, now: () => new Date() };

const todayUtc = () => new Date().toISOString().slice(0, 10);
const todaysPostData = async () => postDataFor(await ensureDay(store, todayUtc()));

const PREVIEW_POST_ID = 'preview-post';

const app = new Hono();

app.use('/api/*', async (c, next) => {
  let user = getCookie(c, 'pt-user');
  if (!user) {
    user = `guest-${Math.random().toString(36).slice(2, 10)}`;
    setCookie(c, 'pt-user', user, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'Lax' });
  }
  c.set('user' as never, user as never);
  await next();
});

const userOf = (c: { get: (k: string) => unknown }) => c.get('user') as string;

app.get('/api/init', async (c) => {
  const day = await todaysPostData();
  return c.json<InitResponse>(await initSession(ports, day, userOf(c)));
});

app.post('/api/event', async (c) => {
  const { journeyId, event } = await c.req.json<EventRequest>();
  await recordEvent(ports, journeyId, event).catch(() => undefined);
  return c.json({ ok: true });
});

app.post('/api/submit', async (c) => {
  const day = await todaysPostData();
  const body = await c.req.json<SubmitRequest>();
  if (body.date !== day.date)
    return c.json<ErrorResponse>({ status: 'error', message: 'Wrong day.' }, 400);
  try {
    const card = await submitTown(ports, day, userOf(c), body.placement, body.timeMs, body.journeyId);
    return c.json<SubmitResponse>({ type: 'submit', card });
  } catch (err) {
    if (err instanceof InvalidTownError)
      return c.json<ErrorResponse>({ status: 'error', message: err.message }, 400);
    throw err;
  }
});

app.post('/api/post-town', async (c) => {
  const day = await todaysPostData();
  const res = await postTown(ports, day, userOf(c), PREVIEW_POST_ID);
  return c.json<PostTownResponse>({ type: 'post-town', ...res });
});

app.post('/api/subscribe', async (c) => {
  const res = await subscribe(ports, userOf(c));
  return c.json<SubscribeResponse>({ type: 'subscribe', ...res });
});

app.get('/', async (c) => {
  const html = await readFile('./dist/client/game.html', 'utf8');
  return c.html(html);
});
app.use('/*', serveStatic({ root: './dist/client' }));

const port = Number(process.env.PORT ?? 56820);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Plot Twist preview listening on http://127.0.0.1:${port}`);
});
