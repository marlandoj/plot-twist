// @vitest-environment jsdom
/**
 * Scripted end-to-end round: the real React app in jsdom, its platform layer wired
 * straight into the real server core (fake Redis/Reddit/Journeys underneath).
 * Places all 5 buildings by tapping lots, opens the town, reads the result card,
 * and presses Post my town.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { initSession, postTown, recordEvent, submitTown, subscribe } from '../src/server/core/game';
import { ensureDay, postDataFor, puzzleFromPostData } from '../src/server/core/days';
import { solve } from '../src/shared/solver';
import { wishText } from '../src/shared/rules';
import { BUILDING_BY_ID } from '../src/shared/catalog';
import { makePorts } from './support/fakes';

const DATE = '2026-11-12';
const USER = 'playtester';
const env = makePorts({ now: new Date(`${DATE}T15:00:00Z`) });
let clock = Date.parse(`${DATE}T15:00:00Z`);
const toasts: string[] = [];

vi.mock('../src/client/platform', () => {
  const day = async () => postDataFor(await ensureDay(env.store, DATE));
  return {
    platform: {
      init: async () => initSession(env.ports, await day(), USER),
      submit: async (req: { placement: number[]; timeMs: number; journeyId: string | null }) => ({
        type: 'submit',
        card: await submitTown(env.ports, await day(), USER, req.placement, req.timeMs, req.journeyId),
      }),
      event: (journeyId: string | null, event: 'first_placement' | 'town_opened' | 'result_posted') => {
        void recordEvent(env.ports, journeyId, event);
      },
      postTown: async () => ({ type: 'post-town', ...(await postTown(env.ports, await day(), USER, 't3_today')) }),
      subscribe: async () => ({ type: 'subscribe', ...(await subscribe(env.ports, USER)) }),
      toast: (t: string) => toasts.push(t),
      now: () => clock,
    },
  };
});

const { App } = await import('../src/client/App');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (ms = 0) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};
const click = async (el: Element | null) => {
  if (!el) throw new Error('nothing to click');
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';

describe('scripted playthrough of one full round', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  afterAll(() => act(() => root.unmount()));

  it('plays today end to end and shows every result-card value', async () => {
    const day = postDataFor(await ensureDay(env.store, DATE));
    const puzzle = puzzleFromPostData(day);
    // Two earlier players so the crowd stats on the card are meaningful.
    const perfect = solve(puzzle).example;
    await submitTown(env.ports, day, 'early_bird', perfect, 240_000, null);
    const free = [...Array(24).keys()].filter((c) => !puzzle.landmarks.some((l) => l.cell === c));
    await submitTown(env.ports, day, 'night_owl', free.slice(0, 5), 90_000, null);

    const log: string[] = [];
    const t0 = performance.now();
    await act(async () => root.render(<App />));
    await flush();

    // First meaningful tap is available immediately: a ghost lot and a contextual hint, no instructions screen.
    expect(document.querySelector('.lot.ghost')).not.toBeNull();
    const firstHint = text('.hint');
    expect(firstHint).toMatch(/^Tap a lot to build the /);
    log.push(`ready in ${(performance.now() - t0).toFixed(0)}ms (jsdom), hint: "${firstHint}"`);
    log.push(`street: ${day.date} (${puzzle.landmarks.map((l) => `${l.id}@${l.cell}`).join(', ')})`);
    puzzle.residents.forEach((r, i) =>
      log.push(`  ${r.name} the ${BUILDING_BY_ID[puzzle.buildings[i]!].owner}: ${r.wishes.map((w) => `"${wishText(w, puzzle)}"`).join(' ')}`)
    );

    // Place all 5 buildings by tapping lots. The tray auto-advances to the next building.
    for (let slot = 0; slot < 5; slot++) {
      clock += 18_000;
      await click(document.querySelector(`[data-cell="${perfect[slot]}"]`));
      const statuses = [...document.querySelectorAll('.wish')].map((w) => w.getAttribute('data-status'));
      log.push(`tap lot ${perfect[slot]} -> ${BUILDING_BY_ID[puzzle.buildings[slot]!].name}; wishes ${statuses.join(',')}; hint "${text('.hint')}"`);
    }
    const statuses = [...document.querySelectorAll('.wish')].map((w) => w.getAttribute('data-status'));
    expect(statuses.every((s) => s === 'met')).toBe(true);

    // The clock started at the first placement; the player looks it over for 18s, then opens the town.
    clock += 18_000;
    const open = document.querySelector('.btn.open');
    expect(open?.textContent).toContain('Open the town');
    await click(open);
    await flush(1100);

    const card = document.querySelector('.card');
    expect(card).not.toBeNull();
    const values = {
      grade: text('[data-testid="grade"]'),
      percentPerfect: text('[data-testid="percent-perfect"]'),
      percentile: text('[data-testid="percentile"]'),
      time: text('[data-testid="time"]'),
      streak: text('[data-testid="streak"]'),
      teaser: text('[data-testid="teaser"]'),
      snapshotWidth: document.querySelector('.board.snapshot')?.getAttribute('width'),
      actions: [...document.querySelectorAll('.actions button')].map((b) => b.textContent),
    };
    log.push(`result card: ${JSON.stringify(values)}`);
    expect(values.grade).toBe('Perfect Town!');
    expect(values.percentPerfect).toBe('67%');
    expect(values.percentile).toBe('100%');
    expect(values.time).toBe('1:30');
    expect(values.streak).toBe('1');
    expect(values.teaser).toMatch(/Tomorrow · Friday/);
    expect(values.snapshotWidth).toBe('300');
    expect(values.actions).toEqual(['Post my town', 'Subscribe']);

    await click(document.querySelector('.actions .btn.primary'));
    await flush();
    expect(env.rec.userComments).toHaveLength(1);
    log.push(`posted comment:\n${env.rec.userComments[0]!.text}`);
    expect(document.querySelector('.actions .btn.primary')?.textContent).toBe('Town posted ✓');

    await flush(10);
    const journey = env.rec.journeys.at(-1)!;
    log.push(`journey events: ${journey.events.join(' -> ')}; ended ${JSON.stringify(journey.ended)}`);
    expect(journey.events).toEqual(['session_start', 'first_placement', 'town_opened', 'result_posted']);
    log.push(`toasts: ${JSON.stringify(toasts)}`);
    console.log(`\n=== PLAYTHROUGH ===\n${log.join('\n')}\n===================`);
  });
});
