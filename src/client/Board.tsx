import type { KeyboardEvent } from 'react';
import { BUILDING_BY_ID, LANDMARKS, STREET_NAMES } from '../shared/catalog';
import { CELLS, COLS, ROWS, colOf, rowOf } from '../shared/grid';
import type { Placement, Puzzle, WishStatus } from '../shared/types';
import { BuildingArt, Face, LandmarkArt, type Mood } from './art';

export const moodFor = (statuses: WishStatus[]): Mood =>
  statuses.some((s) => s === 'broken') ? 'upset' : statuses.length > 0 && statuses.every((s) => s === 'met') ? 'happy' : 'neutral';

type Props = {
  puzzle: Puzzle;
  placement: Placement;
  statuses: WishStatus[][];
  selected?: number | null;
  ghost?: number | null;
  onTap?: (cell: number) => void;
  /** Static snapshot mode for the result card. */
  width?: number;
};

const LOT = 100;
// Tiny per-lot tilt makes the cut-paper lots feel hand-placed (deterministic per cell).
const tilt = (cell: number) => ((cell * 37) % 7) - 3;

export const Board = ({ puzzle, placement, statuses, selected = null, ghost = null, onTap, width }: Props) => {
  const interactive = Boolean(onTap);
  const occupant = new Map<number, number>();
  placement.forEach((cell, slot) => cell >= 0 && occupant.set(cell, slot));
  const landmarkAt = new Map(puzzle.landmarks.map((l) => [l.cell, l.id]));
  const ghostSlot = selected ?? 0;

  return (
    <svg
      className={interactive ? 'board' : 'board snapshot'}
      viewBox={`-8 -8 ${COLS * LOT + 16} ${ROWS * LOT + 16}`}
      {...(width ? { width, height: Math.round((width * (ROWS * LOT + 16)) / (COLS * LOT + 16)) } : {})}
      role={interactive ? 'grid' : 'img'}
      aria-label={interactive ? 'Town map' : `Town snapshot for ${puzzle.date}`}
    >
      <rect x="-8" y="-8" width={COLS * LOT + 16} height={ROWS * LOT + 16} rx="18" fill="var(--board)" />
      {/* Main Street runs along the bottom row */}
      <rect x="0" y={(ROWS - 1) * LOT + 4} width={COLS * LOT} height={LOT - 8} rx="10" fill="var(--street)" />
      {[...Array(CELLS).keys()].map((cell) => {
        const x = colOf(cell) * LOT;
        const y = rowOf(cell) * LOT;
        const slot = occupant.get(cell);
        const mark = landmarkAt.get(cell);
        const isGhost = ghost === cell && slot === undefined;
        const label =
          slot !== undefined
            ? `${BUILDING_BY_ID[puzzle.buildings[slot]!].name} on ${STREET_NAMES[rowOf(cell)]}`
            : mark
              ? LANDMARKS[mark].name
              : `Empty lot on ${STREET_NAMES[rowOf(cell)]}, column ${colOf(cell) + 1}`;
        return (
          <g
            key={cell}
            transform={`translate(${x} ${y})`}
            className={`lot${slot !== undefined && slot === selected ? ' selected' : ''}${isGhost ? ' ghost' : ''}`}
            data-cell={cell}
            {...(interactive
              ? {
                  role: 'gridcell',
                  tabIndex: 0,
                  'aria-label': label,
                  onClick: () => onTap?.(cell),
                  onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onTap?.(cell),
                }
              : {})}
          >
            <rect
              x="6"
              y="6"
              width={LOT - 12}
              height={LOT - 12}
              rx="12"
              fill={mark ? 'var(--grass-dark)' : 'var(--grass)'}
              stroke="var(--ink-soft)"
              strokeWidth="2"
              strokeDasharray={slot === undefined && !mark ? '6 6' : undefined}
              transform={`rotate(${tilt(cell) * 0.6} 50 50)`}
            />
            {mark && <LandmarkArt id={mark} />}
            {slot !== undefined && (
              <>
                <BuildingArt id={puzzle.buildings[slot]!} lifted={slot === selected} />
                <Face
                  look={puzzle.residents[slot]!.look}
                  mood={moodFor(statuses[slot] ?? [])}
                  size={36}
                  x={64}
                  y={0}
                />
              </>
            )}
            {isGhost && (
              <g className="ghost-art" opacity="0.4">
                <BuildingArt id={puzzle.buildings[ghostSlot]!} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
