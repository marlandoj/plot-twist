import { BUILDING_BY_ID, LANDMARKS } from '../shared/catalog';
import { RULE_HINTS, evaluateWish } from '../shared/rules';
import { greedyTown } from '../shared/solver';
import type { Placement, Puzzle, WishStatus } from '../shared/types';

/** Pure placement loop, shared by the React UI and the scripted playthrough. */
export type BuildState = {
  placement: Placement;
  /** Building slot in hand, or null. */
  selected: number | null;
  startedAt: number | null;
  moves: number;
  hint: string;
  /** Rule types whose hint has already been shown once. */
  taught: string[];
};

export const nextUnplaced = (placement: Placement, after = -1): number | null => {
  for (let i = 1; i <= placement.length; i++) {
    const slot = (after + i) % placement.length;
    if (placement[slot]! < 0) return slot;
  }
  return null;
};

const name = (puzzle: Puzzle, slot: number) => BUILDING_BY_ID[puzzle.buildings[slot]!].name;

export const initialState = (puzzle: Puzzle): BuildState => ({
  placement: new Array<number>(puzzle.buildings.length).fill(-1),
  selected: 0,
  startedAt: null,
  moves: 0,
  hint: `Tap a lot to build the ${name(puzzle, 0)}`,
  taught: [],
});

/** Where the ghost of the first building pulses. A sensible, not optimal, lot. */
export const ghostLot = (puzzle: Puzzle): number => greedyTown(puzzle).placement[0] ?? 0;

export const allPlaced = (s: BuildState) => s.placement.every((c) => c >= 0);

export const wishStatuses = (puzzle: Puzzle, placement: Placement): WishStatus[][] =>
  puzzle.residents.map((r) => r.wishes.map((w) => evaluateWish(w, placement, puzzle)));

/** After a move, teach the first newly broken rule type once, in context. */
const teach = (puzzle: Puzzle, s: BuildState): BuildState => {
  for (const r of puzzle.residents) {
    for (const w of r.wishes) {
      if (s.taught.includes(w.type)) continue;
      if (evaluateWish(w, s.placement, puzzle) === 'broken') {
        return { ...s, hint: `${r.name} frowns. ${RULE_HINTS[w.type]}`, taught: [...s.taught, w.type] };
      }
    }
  }
  return s;
};

export const tapLot = (puzzle: Puzzle, s: BuildState, cell: number, now: number): BuildState => {
  const landmark = puzzle.landmarks.find((l) => l.cell === cell);
  if (landmark) return { ...s, hint: `That's the ${LANDMARKS[landmark.id].name}. Build around it.` };

  const occupant = s.placement.indexOf(cell);
  if (occupant >= 0) {
    if (s.selected === occupant) {
      // Second tap on the building in hand sends it back to the tray.
      const placement = [...s.placement];
      placement[occupant] = -1;
      return { ...s, placement, selected: occupant, hint: `${name(puzzle, occupant)} is back in the tray. Tap a lot.` };
    }
    return { ...s, selected: occupant, hint: `Moving the ${name(puzzle, occupant)}. Tap an empty lot, or tap it again to lift it off.` };
  }

  if (s.selected === null) return { ...s, hint: 'Pick a building from the tray first.' };

  const placement = [...s.placement];
  placement[s.selected] = cell;
  const selected = nextUnplaced(placement, s.selected);
  const placed = placement.filter((c) => c >= 0).length;
  let hint: string;
  if (selected === null) hint = 'Everyone has a home. Happy with it? Open the town!';
  else if (s.moves === 0) hint = `Watch their faces. Now the ${name(puzzle, selected)}.`;
  else hint = `${placed} of ${placement.length} built. Next: the ${name(puzzle, selected)}.`;
  return teach(puzzle, {
    ...s,
    placement,
    selected,
    startedAt: s.startedAt ?? now,
    moves: s.moves + 1,
    hint,
  });
};

export const tapTray = (puzzle: Puzzle, s: BuildState, slot: number): BuildState => ({
  ...s,
  selected: slot,
  hint:
    s.placement[slot]! >= 0
      ? `Moving the ${name(puzzle, slot)}. Tap an empty lot.`
      : `Tap a lot to build the ${name(puzzle, slot)}.`,
});

export const elapsed = (s: BuildState, now: number) => (s.startedAt === null ? 0 : now - s.startedAt);
