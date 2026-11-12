import { BUILDING_BY_ID, LANDMARKS } from './catalog';
import { CELLS, COLS } from './grid';
import type { Placement, Puzzle } from './types';
import type { RoundResult } from './scoring';
import { formatTime } from './scoring';

export const EMPTY_LOT = '🟩';

/** 6 emoji per line, 4 lines: reads cleanly in a 300px-wide comment column. */
export const townEmojiRows = (puzzle: Puzzle, placement: Placement): string[] => {
  const cells: string[] = new Array<string>(CELLS).fill(EMPTY_LOT);
  for (const l of puzzle.landmarks) cells[l.cell] = LANDMARKS[l.id].emoji;
  placement.forEach((cell, slot) => {
    const id = puzzle.buildings[slot];
    if (cell >= 0 && id) cells[cell] = BUILDING_BY_ID[id].emoji;
  });
  const rows: string[] = [];
  for (let r = 0; r < CELLS / COLS; r++) rows.push(cells.slice(r * COLS, r * COLS + COLS).join(''));
  return rows;
};

const wishBar = (met: number, total: number) => '💚'.repeat(met) + '🤍'.repeat(total - met);

/** The "Post my town" comment body. The guaranteed fallback when image comments are unavailable. */
export const resultComment = (
  puzzle: Puzzle,
  placement: Placement,
  result: RoundResult,
  streak: number
): string => {
  const rows = townEmojiRows(puzzle, placement);
  const lines = [
    `**Plot Twist ${puzzle.date}** · ${result.grade} · ${result.met}/${result.total} wishes · ${formatTime(result.timeMs)}${streak > 1 ? ` · 🔥${streak}` : ''}`,
    '',
    // Two trailing spaces force Markdown line breaks without a code block, so emoji render.
    ...rows.map((r) => `${r}  `),
    '',
    wishBar(result.met, result.total),
  ];
  return lines.join('\n');
};
