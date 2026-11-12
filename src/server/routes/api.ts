import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ErrorResponse,
  EventRequest,
  InitResponse,
  PostTownResponse,
  SubmitRequest,
  SubmitResponse,
  SubscribeResponse,
} from '../../shared/api';
import { InvalidTownError } from '../../shared/scoring';
import { devvitPorts } from '../core/devvit';
import { isDayPostData } from '../core/days';
import { initSession, postTown, recordEvent, submitTown, subscribe } from '../core/game';

export const api = new Hono();

const currentDay = () => (isDayPostData(context.postData) ? context.postData : null);
const currentUser = async () => (await reddit.getCurrentUsername()) ?? null;
const noDay = { status: 'error', message: 'This post has no Plot Twist day attached.' } as const;

api.get('/init', async (c) => {
  const day = currentDay();
  if (!day) return c.json<ErrorResponse>(noDay, 400);
  return c.json<InitResponse>(await initSession(devvitPorts, day, await currentUser()));
});

api.post('/event', async (c) => {
  const { journeyId, event } = await c.req.json<EventRequest>();
  await recordEvent(devvitPorts, journeyId, event).catch((err: unknown) => console.error('journey event', err));
  return c.json({ ok: true });
});

api.post('/submit', async (c) => {
  const day = currentDay();
  if (!day) return c.json<ErrorResponse>(noDay, 400);
  const body = await c.req.json<SubmitRequest>();
  if (body.date !== day.date) return c.json<ErrorResponse>({ status: 'error', message: 'Wrong day.' }, 400);
  try {
    const card = await submitTown(devvitPorts, day, await currentUser(), body.placement, body.timeMs, body.journeyId);
    return c.json<SubmitResponse>({ type: 'submit', card });
  } catch (err) {
    if (err instanceof InvalidTownError) return c.json<ErrorResponse>({ status: 'error', message: err.message }, 400);
    throw err;
  }
});

api.post('/post-town', async (c) => {
  const day = currentDay();
  if (!day) return c.json<ErrorResponse>(noDay, 400);
  const res = await postTown(devvitPorts, day, await currentUser(), context.postId);
  return c.json<PostTownResponse>({ type: 'post-town', ...res });
});

api.post('/subscribe', async (c) => {
  const res = await subscribe(devvitPorts, await currentUser());
  return c.json<SubscribeResponse>({ type: 'subscribe', ...res });
});
