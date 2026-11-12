import { BUILDING_BY_ID, LANDMARKS, STREET_NAMES } from './catalog';
import {
  colOf,
  isAdjacent,
  isCorner,
  isEdge,
  MAIN_STREET_ROW,
  manhattan,
  neighbours,
  rowOf,
} from './grid';
import type { Placement, Puzzle, RuleType, Wish, WishStatus } from './types';

export const RULE_TYPES: readonly RuleType[] = [
  'adjacent',
  'notAdjacent',
  'corner',
  'edge',
  'sameRow',
  'farFrom',
  'sameColumn',
  'inland',
  'northOf',
  'byLandmark',
  'quiet',
  'mainStreet',
];

export const PAIR_RULES: ReadonlySet<RuleType> = new Set([
  'adjacent',
  'notAdjacent',
  'sameRow',
  'farFrom',
  'sameColumn',
  'northOf',
]);

/** "Far" means at least this many steps along the streets. */
export const FAR_DISTANCE = 4;

const pair = (
  wish: Wish,
  placement: Placement,
  test: (a: number, b: number) => boolean
): WishStatus => {
  const a = placement[wish.a] ?? -1;
  const b = placement[wish.b ?? -1] ?? -1;
  if (a < 0 || b < 0) return 'pending';
  return test(a, b) ? 'met' : 'broken';
};

const single = (wish: Wish, placement: Placement, test: (a: number) => boolean): WishStatus => {
  const a = placement[wish.a] ?? -1;
  if (a < 0) return 'pending';
  return test(a) ? 'met' : 'broken';
};

/**
 * Evaluates a wish against a (possibly partial) placement.
 * Monotone: 'met' and 'broken' never change as more buildings are placed
 * (without moving existing ones), so the solver can prune on them.
 */
export const evaluateWish = (wish: Wish, placement: Placement, puzzle: Puzzle): WishStatus => {
  switch (wish.type) {
    case 'adjacent':
      return pair(wish, placement, isAdjacent);
    case 'notAdjacent':
      return pair(wish, placement, (a, b) => !isAdjacent(a, b));
    case 'farFrom':
      return pair(wish, placement, (a, b) => manhattan(a, b) >= FAR_DISTANCE);
    case 'sameRow':
      return pair(wish, placement, (a, b) => rowOf(a) === rowOf(b));
    case 'sameColumn':
      return pair(wish, placement, (a, b) => colOf(a) === colOf(b));
    case 'northOf':
      return pair(wish, placement, (a, b) => rowOf(a) < rowOf(b));
    case 'corner':
      return single(wish, placement, isCorner);
    case 'edge':
      return single(wish, placement, isEdge);
    case 'inland':
      return single(wish, placement, (a) => !isEdge(a));
    case 'mainStreet':
      return single(wish, placement, (a) => rowOf(a) === MAIN_STREET_ROW);
    case 'byLandmark': {
      const mark = puzzle.landmarks.find((l) => l.id === wish.landmark);
      if (!mark) return 'broken';
      return single(wish, placement, (a) => isAdjacent(a, mark.cell));
    }
    case 'quiet': {
      const a = placement[wish.a] ?? -1;
      if (a < 0) return 'pending';
      const near = new Set(neighbours(a));
      let allPlaced = true;
      for (let slot = 0; slot < placement.length; slot++) {
        if (slot === wish.a) continue;
        const cell = placement[slot] ?? -1;
        if (cell < 0) {
          allPlaced = false;
          continue;
        }
        if (near.has(cell)) return 'broken';
      }
      return allPlaced ? 'met' : 'pending';
    }
  }
};

export const allWishes = (puzzle: Puzzle): Wish[] => puzzle.residents.flatMap((r) => r.wishes);

export type TownScore = { met: number; broken: number; pending: number; total: number };

export const scoreTown = (puzzle: Puzzle, placement: Placement): TownScore => {
  const out: TownScore = { met: 0, broken: 0, pending: 0, total: 0 };
  for (const wish of allWishes(puzzle)) {
    out[evaluateWish(wish, placement, puzzle)]++;
    out.total++;
  }
  return out;
};

const lower = (s: string) => s.toLowerCase();

/** Phrasings per rule. {A} = speaker's own building, {B} = other building, {L} = landmark. */
export const PHRASINGS: Record<RuleType, readonly string[]> = {
  adjacent: ['I want to wake up next to the {B}.', 'Put my {A} right beside the {B}.'],
  notAdjacent: ['Keep the {B} away from my door.', "Don't put the {B} next to my {A}."],
  farFrom: ['Keep the {B} far from my {A}.', 'The {B} must be far, far away from me.'],
  corner: ['Put my {A} on a corner.', 'A corner lot for my {A}, please.'],
  edge: ['My {A} should be on the edge of town.', 'I like a view of the fields. Edge of town!'],
  inland: ['I want my {A} in the middle of things.', 'No edge lots for me. Put me inside town.'],
  sameRow: ['I want the {B} on my street.', 'My {A} and the {B} share a street.'],
  sameColumn: ['I want to see the {B} from my window, straight up or down the lane.', 'Line my {A} up with the {B}, same column.'],
  northOf: ['My {A} goes north of the {B}.', 'I want to look down on the {B}. Put me further north.'],
  byLandmark: ['I want my {A} beside the {L}.', 'Put me next to the {L}. I love it.'],
  quiet: ['No neighbours! Nothing right next to my {A}.', 'Peace and quiet. No buildings touching mine.'],
  mainStreet: ['My {A} belongs on Main Street.', 'Main Street or nothing!'],
};

/** Short contextual hint that teaches the geometry without an instruction screen. */
export const RULE_HINTS: Record<RuleType, string> = {
  adjacent: 'Next to = sharing a side.',
  notAdjacent: 'Not sharing a side. Diagonal is fine.',
  farFrom: `Far = ${FAR_DISTANCE}+ steps apart, counting along the streets.`,
  corner: 'One of the four corner lots.',
  edge: 'Any lot on the outer ring.',
  inland: 'Any lot not on the outer ring.',
  sameRow: 'Same street = same row.',
  sameColumn: 'Same column.',
  northOf: 'North = higher up the map.',
  byLandmark: 'Sharing a side with the landmark.',
  quiet: 'No building may share a side with it.',
  mainStreet: `${STREET_NAMES[MAIN_STREET_ROW]} is the bottom row.`,
};

/** The nanny's wishes are about the baby. */
const DAYCARE_PHRASINGS: Partial<Record<RuleType, string>> = {
  farFrom: 'Keep the {B} far from my baby.',
  notAdjacent: 'Keep the {B} away from my baby.',
};

export const wishText = (wish: Wish, puzzle: Puzzle): string => {
  const options = PHRASINGS[wish.type];
  const a = puzzle.buildings[wish.a];
  const template =
    (a === 'daycare' ? DAYCARE_PHRASINGS[wish.type] : undefined) ?? options[wish.phrasing % options.length] ?? options[0]!;
  const b = wish.b === undefined ? undefined : puzzle.buildings[wish.b];
  return template
    .replace('{A}', a ? lower(BUILDING_BY_ID[a].name) : 'place')
    .replace('{B}', b ? lower(BUILDING_BY_ID[b].name) : 'other place')
    .replace('{L}', wish.landmark ? LANDMARKS[wish.landmark].name : 'landmark');
};
