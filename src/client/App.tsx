import { useEffect, useMemo, useRef, useState } from 'react';
import type { InitResponse, ResultCard as Card } from '../shared/api';
import { BUILDING_BY_ID } from '../shared/catalog';
import { buildCandidate, WEEKDAY_NAMES } from '../shared/generator';
import { wishText } from '../shared/rules';
import { formatTime } from '../shared/scoring';
import type { Puzzle } from '../shared/types';
import { BuildingArt, Face } from './art';
import { Board, moodFor } from './Board';
import { platform } from './platform';
import { ResultCard } from './ResultCard';
import { allPlaced, elapsed, ghostLot, initialState, tapLot, tapTray, wishStatuses, type BuildState } from './state';

const STATUS_ICON = { met: '✓', broken: '✗', pending: '·' } as const;

const Clock = ({ state }: { state: BuildState }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (state.startedAt === null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.startedAt]);
  return <span className="clock" aria-label="time">⏱ {formatTime(elapsed(state, platform.now()))}</span>;
};

const Game = ({ init, puzzle, onDone }: { init: InitResponse; puzzle: Puzzle; onDone: (c: Card) => void }) => {
  const [state, setState] = useState<BuildState>(() => initialState(puzzle));
  const [opening, setOpening] = useState(false);
  const ghost = useMemo(() => ghostLot(puzzle), [puzzle]);
  const statuses = wishStatuses(puzzle, state.placement);
  const sentFirst = useRef(false);

  const onTapLot = (cell: number) => {
    const next = tapLot(puzzle, state, cell, platform.now());
    if (!sentFirst.current && next.moves > 0) {
      sentFirst.current = true;
      platform.event(init.journeyId, 'first_placement');
    }
    setState(next);
  };

  const openTown = async () => {
    setOpening(true);
    platform.event(init.journeyId, 'town_opened');
    const timeMs = elapsed(state, platform.now());
    try {
      const [res] = await Promise.all([
        platform.submit({ date: puzzle.date, placement: state.placement, timeMs, journeyId: init.journeyId }),
        new Promise((r) => setTimeout(r, 900)),
      ]);
      onDone(res.card);
    } catch (err) {
      setOpening(false);
      platform.toast(err instanceof Error ? err.message : 'Could not open the town');
    }
  };

  const met = statuses.flat().filter((s) => s === 'met').length;
  const total = statuses.flat().length;
  const ready = allPlaced(state);

  return (
    <main className={`game${opening ? ' opening' : ''}`}>
      <header className="top">
        <span className="wordmark">Plot Twist</span>
        <span className="muted">{WEEKDAY_NAMES[puzzle.difficulty]}</span>
        <span className="spacer" />
        {init.streak > 0 && <span aria-label="streak">🔥{init.streak}</span>}
        <Clock state={state} />
      </header>
      <p className="hint" role="status" aria-live="polite">
        {state.hint}
      </p>
      <div className="board-wrap">
        <Board
          puzzle={puzzle}
          placement={state.placement}
          statuses={statuses}
          selected={state.selected}
          ghost={state.moves === 0 ? ghost : null}
          onTap={onTapLot}
        />
        {opening && <div className="ribbon" aria-hidden="true" />}
      </div>
      {ready ? (
        <button className="btn primary open" onClick={openTown} disabled={opening}>
          {opening ? 'Cutting the ribbon…' : `Open the town ✂️  ${met}/${total} wishes`}
        </button>
      ) : (
        <div className="tray" role="toolbar" aria-label="Buildings">
          {puzzle.buildings.map((id, slot) => (
            <button
              key={id}
              className={`chip${state.selected === slot ? ' selected' : ''}${state.placement[slot]! >= 0 ? ' placed' : ''}`}
              onClick={() => setState(tapTray(puzzle, state, slot))}
              aria-pressed={state.selected === slot}
              style={{ ['--accent' as string]: BUILDING_BY_ID[id].accent }}
            >
              <svg viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">
                <BuildingArt id={id} />
              </svg>
              <span>{BUILDING_BY_ID[id].name}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="residents" aria-label="Residents and their wishes">
        {puzzle.residents.map((r, slot) => {
          const s = statuses[slot] ?? [];
          return (
            <li key={r.name} className={`resident mood-${moodFor(s)}`} style={{ ['--accent' as string]: BUILDING_BY_ID[puzzle.buildings[slot]!].accent }}>
              <Face look={r.look} mood={moodFor(s)} size={36} />
              <div>
                <div className="who">
                  <strong>{r.name}</strong> <span className="muted">the {BUILDING_BY_ID[puzzle.buildings[slot]!].owner}</span>
                  {r.creditedTo && <span className="credit"> · suggested by u/{r.creditedTo}</span>}
                </div>
                {r.wishes.map((w, i) => (
                  <div key={i} className={`wish ${s[i]}`} data-status={s[i]}>
                    <span className="icon" aria-label={s[i]}>
                      {STATUS_ICON[s[i] ?? 'pending']}
                    </span>
                    “{wishText(w, puzzle)}”
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
};

export const App = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platform
      .init()
      .then((res) => {
        setInit(res);
        setCard(res.card);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load today’s street'));
  }, []);

  const puzzle = useMemo(() => (init ? buildCandidate(init.day.date, init.day.roll, init.day.guest) : null), [init]);

  if (error) return <main className="center"><p>{error}</p></main>;
  if (!init || !puzzle) return <main className="center"><span className="wordmark">Plot Twist</span></main>;
  if (card) return <ResultCard puzzle={puzzle} card={card} journeyId={init.journeyId} />;
  return <Game init={init} puzzle={puzzle} onDone={setCard} />;
};
