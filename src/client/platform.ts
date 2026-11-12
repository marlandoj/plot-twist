import { showToast } from '@devvit/web/client';
import type {
  EventRequest,
  InitResponse,
  JourneyEvent,
  PostTownResponse,
  SubmitRequest,
  SubmitResponse,
  SubscribeResponse,
} from '../shared/api';

/** Every call the client makes to the outside world goes through here (mocked in tests). */

const json = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
};

const post = <T>(path: string, body: unknown) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(
    (r) => json<T>(r)
  );

export const platform = {
  init: () => fetch('/api/init').then((r) => json<InitResponse>(r)),
  submit: (req: SubmitRequest) => post<SubmitResponse>('/api/submit', req),
  event: (journeyId: string | null, event: JourneyEvent) => {
    const req: EventRequest = { journeyId, event };
    // Telemetry must never block play.
    void post('/api/event', req).catch(() => undefined);
  },
  postTown: () => post<PostTownResponse>('/api/post-town', {}),
  subscribe: () => post<SubscribeResponse>('/api/subscribe', {}),
  toast: (text: string) => showToast(text),
  now: () => Date.now(),
};
