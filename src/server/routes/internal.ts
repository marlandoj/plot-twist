import { Hono } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { utcDate } from '../../shared/generator';
import {
  approveSuggestion,
  dailyRollover,
  describeGuest,
  mayorsWall,
  pendingSuggestions,
  publishDay,
  rejectSuggestion,
} from '../core/community';
import { devvitPorts } from '../core/devvit';
import { ensureQueue } from '../core/days';

const today = () => utcDate(devvitPorts.now());
const postUrl = (postId: string) => `https://reddit.com/r/${context.subredditName}/comments/${postId}`;

export const menu = new Hono();

menu.post('/post-today', async (c) => {
  try {
    const rec = await publishDay(devvitPorts, today());
    return c.json<UiResponse>({ navigateTo: postUrl(rec.postId ?? '') });
  } catch (error) {
    console.error('post-today failed', error);
    return c.json<UiResponse>({ showToast: "Could not post today's town" }, 400);
  }
});

menu.post('/review-suggestions', async (c) => {
  const pending = await pendingSuggestions(devvitPorts.store, 10);
  if (pending.length === 0) return c.json<UiResponse>({ showToast: 'No resident suggestions waiting.' });
  return c.json<UiResponse>({
    showForm: {
      name: 'reviewSuggestion',
      form: {
        title: 'Who moves in?',
        description: 'Top-voted community residents that fit the wish grammar.',
        acceptLabel: 'Apply',
        fields: [
          {
            type: 'select',
            name: 'suggestion',
            label: 'Resident',
            required: true,
            options: pending.map((s) => ({ label: `${s.votes}▲ ${describeGuest(s.guest)}: ${s.body.slice(0, 80)}`, value: s.id })),
          },
          {
            type: 'select',
            name: 'decision',
            label: 'Decision',
            required: true,
            options: [
              { label: 'Approve: schedule within 7 days', value: 'approve' },
              { label: 'Reject', value: 'reject' },
            ],
          },
        ],
      },
    },
  });
});

export const forms = new Hono();

forms.post('/review-submit', async (c) => {
  const { suggestion, decision } = await c.req.json<{ suggestion?: string[]; decision?: string[] }>();
  const id = suggestion?.[0];
  if (!id) return c.json<UiResponse>({ showToast: 'Pick a resident.' }, 400);
  if (decision?.[0] === 'reject') {
    await rejectSuggestion(devvitPorts.store, id);
    return c.json<UiResponse>({ showToast: 'Suggestion rejected.' });
  }
  const s = await approveSuggestion(devvitPorts, id, today());
  return c.json<UiResponse>({
    showToast: s.scheduledFor
      ? `${s.guest.name} moves in on ${s.scheduledFor}.`
      : `${s.guest.name} approved; waiting for a fair day.`,
  });
});

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    await ensureQueue(devvitPorts.store, today());
    const rec = await publishDay(devvitPorts, today());
    return c.json<TriggerResponse>({ status: 'success', message: `Plot Twist day ${rec.date} posted as ${rec.postId}` });
  } catch (error) {
    console.error('install failed', error);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to post the first day' }, 400);
  }
});

export const scheduler = new Hono();

scheduler.post('/daily-rollover', async (c) => {
  const res = await dailyRollover(devvitPorts, today());
  console.log('daily rollover', JSON.stringify(res));
  return c.json({ status: 'ok', ...res });
});

scheduler.post('/mayors-wall', async (c) => {
  const res = await mayorsWall(devvitPorts, today());
  console.log('mayors wall', JSON.stringify(res));
  return c.json({ status: 'ok', ...res });
});
