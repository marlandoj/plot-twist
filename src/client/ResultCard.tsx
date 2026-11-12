import { useState } from 'react';
import type { ResultCard as Card } from '../shared/api';
import { BUILDING_BY_ID } from '../shared/catalog';
import { formatTime } from '../shared/scoring';
import type { Puzzle } from '../shared/types';
import { Face } from './art';
import { Board } from './Board';
import { platform } from './platform';
import { wishStatuses } from './state';

type Props = { puzzle: Puzzle; card: Card; journeyId: string | null };

const prettyDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The one and only end screen. Exactly two actions: Post my town, Subscribe. */
export const ResultCard = ({ puzzle, card, journeyId }: Props) => {
  const [posted, setPosted] = useState(card.posted);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<'post' | 'sub' | null>(null);
  const { result } = card;

  const postTown = async () => {
    setBusy('post');
    try {
      const res = await platform.postTown();
      platform.toast(res.message);
      if (res.ok) {
        setPosted(true);
        platform.event(journeyId, 'result_posted');
      }
    } catch (err) {
      platform.toast(err instanceof Error ? err.message : 'Could not post');
    } finally {
      setBusy(null);
    }
  };

  const subscribe = async () => {
    setBusy('sub');
    try {
      const res = await platform.subscribe();
      platform.toast(res.message);
      if (res.ok) setSubscribed(true);
    } catch (err) {
      platform.toast(err instanceof Error ? err.message : 'Could not subscribe');
    } finally {
      setBusy(null);
    }
  };

  const t = card.tomorrow;
  return (
    <section className="card" aria-label="Your result">
      <div className="card-head">
        <span className="wordmark small">Plot Twist</span>
        <span className="muted">{prettyDate(card.date)}</span>
      </div>
      <div className="snapshot-wrap">
        <Board puzzle={puzzle} placement={card.placement} statuses={wishStatuses(puzzle, card.placement)} width={300} />
      </div>
      <div className={`grade ${result.perfect ? 'perfect' : ''}`} data-testid="grade">
        {result.perfect ? 'Perfect Town!' : `Grade ${result.grade}`}
      </div>
      <div className="wishes-granted">
        {'♥'.repeat(result.met)}
        <span className="muted">{'♡'.repeat(result.total - result.met)}</span> {result.met}/{result.total} wishes granted
      </div>
      <dl className="stats">
        <div>
          <dt>found a perfect town</dt>
          <dd data-testid="percent-perfect">{card.percentPerfect}%</dd>
        </div>
        <div>
          <dt>better than</dt>
          <dd data-testid="percentile">{card.percentile}%</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd data-testid="time">{formatTime(result.timeMs)}</dd>
        </div>
        <div>
          <dt>streak</dt>
          <dd data-testid="streak">🔥 {card.streak}</dd>
        </div>
      </dl>
      {card.flair && (
        <p className="flair" data-testid="flair">
          {card.newFlair ? 'New flair unlocked: ' : ''}
          <strong>{card.flair}</strong>
        </p>
      )}
      {t && (
        <div className="teaser" data-testid="teaser">
          <Face look={t.look} mood="neutral" size={44} />
          <p>
            <span className="muted">Tomorrow · {t.weekday}</span>
            <br />
            <strong>{t.residentName}</strong> the {BUILDING_BY_ID[t.building].owner} is moving in…
            {t.creditedTo && <span className="muted"> suggested by u/{t.creditedTo}</span>}
          </p>
        </div>
      )}
      <div className="actions">
        <button className="btn primary" onClick={postTown} disabled={posted || busy !== null}>
          {posted ? 'Town posted ✓' : busy === 'post' ? 'Posting…' : 'Post my town'}
        </button>
        <button className="btn" onClick={subscribe} disabled={subscribed || busy !== null}>
          {subscribed ? 'Subscribed ✓' : busy === 'sub' ? '…' : 'Subscribe'}
        </button>
      </div>
      <p className="muted tiny">{card.players.toLocaleString('en-US')} {card.players === 1 ? 'player' : 'players'} built this street today · new street at 00:00 UTC</p>
    </section>
  );
};
