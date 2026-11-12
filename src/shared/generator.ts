import {
  BUILDINGS,
  FIRST_NAMES,
  HAIR_COLOURS,
  LANDMARK_IDS,
  SKIN_TONES,
  type BuildingId,
} from './catalog';
import { CELLS, isCorner } from './grid';
import { createRng, hashString, type Rng } from './rng';
import { PAIR_RULES, PHRASINGS } from './rules';
import { greedyTown, solve } from './solver';
import type { GuestResident, Landmark, Puzzle, Resident, RuleType, Wish } from './types';

export const BUILDING_COUNT = 5;

/** Monday = 0 (easiest) ... Sunday = 6 (hardest). */
export const difficultyForDate = (date: string): number => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (day + 6) % 7;
};

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Weekday ramp: total wishes and the share of "tricky" rule types. */
export const RAMP = [
  { wishes: 6, tricky: 0.15, landmarks: 2 },
  { wishes: 6, tricky: 0.25, landmarks: 2 },
  { wishes: 7, tricky: 0.3, landmarks: 2 },
  { wishes: 7, tricky: 0.4, landmarks: 3 },
  { wishes: 8, tricky: 0.45, landmarks: 3 },
  { wishes: 9, tricky: 0.5, landmarks: 3 },
  { wishes: 9, tricky: 0.6, landmarks: 3 },
] as const;

const FRIENDLY_RULES: readonly RuleType[] = ['adjacent', 'corner', 'edge', 'sameRow', 'mainStreet', 'byLandmark'];
const TRICKY_RULES: readonly RuleType[] = ['notAdjacent', 'farFrom', 'sameColumn', 'inland', 'northOf', 'quiet'];

const NOISY: ReadonlySet<BuildingId> = new Set(['nightclub', 'garage', 'cinema', 'school']);
const COSY: ReadonlySet<BuildingId> = new Set(['bakery', 'cafe', 'florist', 'bookshop', 'daycare']);

const conflicts = (existing: Wish[], next: Wish): boolean => {
  const sameBuilding = (types: RuleType[]) =>
    existing.some((w) => w.a === next.a && types.includes(w.type));
  if (existing.some((w) => w.type === next.type && w.a === next.a && w.b === next.b && w.landmark === next.landmark))
    return true;
  if (next.b !== undefined && existing.some((w) => w.a === next.b && w.b === next.a)) return true;
  if (next.type === 'inland' && sameBuilding(['corner', 'edge', 'mainStreet'])) return true;
  if (['corner', 'edge', 'mainStreet'].includes(next.type) && sameBuilding(['inland'])) return true;
  if (next.type === 'quiet' && existing.some((w) => w.type === 'adjacent' && (w.a === next.a || w.b === next.a)))
    return true;
  if (next.type === 'adjacent' && existing.some((w) => w.type === 'quiet' && (w.a === next.a || w.a === next.b)))
    return true;
  return false;
};

const pickOther = (rng: Rng, type: RuleType, self: number, buildings: BuildingId[]): number => {
  const others = buildings.map((_, i) => i).filter((i) => i !== self);
  const preferred =
    type === 'notAdjacent' || type === 'farFrom'
      ? others.filter((i) => NOISY.has(buildings[i]!))
      : type === 'adjacent'
        ? others.filter((i) => COSY.has(buildings[i]!))
        : [];
  if (preferred.length > 0 && rng.next() < 0.7) return rng.pick(preferred);
  return rng.pick(others);
};

const makeWish = (
  rng: Rng,
  self: number,
  difficulty: number,
  buildings: BuildingId[],
  landmarks: Landmark[]
): Wish => {
  const ramp = RAMP[difficulty]!;
  const type = rng.next() < ramp.tricky ? rng.pick(TRICKY_RULES) : rng.pick(FRIENDLY_RULES);
  const wish: Wish = { type, a: self, phrasing: rng.int(PHRASINGS[type].length) };
  if (PAIR_RULES.has(type)) wish.b = pickOther(rng, type, self, buildings);
  if (type === 'byLandmark') wish.landmark = rng.pick(landmarks).id;
  return wish;
};

export const daySeed = (date: string, roll: number, guestId?: string) =>
  hashString(`plot-twist|${date}|${roll}|${guestId ?? ''}`);

/**
 * Builds one candidate day deterministically from (date, roll, guest).
 * No solving happens here, so the client can rebuild the day instantly from postData.
 */
export const buildCandidate = (date: string, roll: number, guest?: GuestResident): Puzzle => {
  const rng = createRng(daySeed(date, roll, guest?.id));
  const difficulty = difficultyForDate(date);
  const ramp = RAMP[difficulty]!;

  // Landmarks: distinct kinds, never on corners (corner lots are precious).
  const landmarkKinds = rng.shuffle(LANDMARK_IDS).slice(0, ramp.landmarks);
  const lotPool = rng.shuffle([...Array(CELLS).keys()].filter((c) => !isCorner(c)));
  const landmarks: Landmark[] = landmarkKinds.map((id, i) => ({ id, cell: lotPool[i]! }));

  // Buildings: guest building and the buildings its wishes mention come first.
  const required: BuildingId[] = [];
  if (guest) {
    for (const id of [guest.building, ...guest.wishes.map((w) => w.other)]) {
      if (id && !required.includes(id)) required.push(id);
    }
  }
  const rest = rng.shuffle(BUILDINGS.map((b) => b.id).filter((id) => !required.includes(id)));
  const chosen = [...required, ...rest].slice(0, BUILDING_COUNT);
  // Guest owns the last slot; everyone else is shuffled.
  const others = rng.shuffle(chosen.filter((id) => id !== guest?.building));
  const buildings = guest ? [...others.slice(0, BUILDING_COUNT - 1), guest.building] : others;

  // Wish counts: everyone gets 1, the remainder go to random residents (max 2 each).
  const counts = new Array<number>(BUILDING_COUNT).fill(1);
  let extra = ramp.wishes - BUILDING_COUNT;
  const guestSlot = guest ? BUILDING_COUNT - 1 : -1;
  if (guest) {
    counts[guestSlot] = guest.wishes.length;
    extra -= guest.wishes.length - 1;
  }
  const extraPool = rng.shuffle([...Array(BUILDING_COUNT).keys()].filter((i) => i !== guestSlot));
  for (const i of extraPool) {
    if (extra <= 0) break;
    counts[i] = 2;
    extra--;
  }

  const names = rng.shuffle(FIRST_NAMES.filter((n) => n !== guest?.name));
  const allSoFar: Wish[] = [];
  const residents: Resident[] = buildings.map((_, slot) => {
    const look = {
      skin: rng.int(SKIN_TONES.length),
      hair: rng.int(HAIR_COLOURS.length),
      hairStyle: rng.int(4),
      accessory: rng.int(4),
    };
    if (guest && slot === guestSlot) {
      const wishes: Wish[] = guest.wishes.map((gw) => {
        const w: Wish = { type: gw.type, a: slot, phrasing: rng.int(PHRASINGS[gw.type].length) };
        if (gw.other) w.b = buildings.indexOf(gw.other);
        if (gw.landmark) w.landmark = gw.landmark;
        return w;
      });
      allSoFar.push(...wishes);
      return { name: guest.name, home: slot, look, wishes, creditedTo: guest.creditedTo };
    }
    const wishes: Wish[] = [];
    let guard = 0;
    while (wishes.length < counts[slot]! && guard++ < 50) {
      const w = makeWish(rng, slot, difficulty, buildings, landmarks);
      if (conflicts(allSoFar, w)) continue;
      wishes.push(w);
      allSoFar.push(w);
    }
    return { name: names[slot]!, home: slot, look, wishes };
  });

  // A guest landmark wish needs its landmark on the map: swap it in if missing.
  if (guest) {
    for (const gw of guest.wishes) {
      if (gw.landmark && !landmarks.some((l) => l.id === gw.landmark)) {
        landmarks[0] = { id: gw.landmark, cell: landmarks[0]!.cell };
      }
    }
  }

  return { date, roll, difficulty, landmarks, buildings, residents };
};

// ---------------------------------------------------------------------------
// Fairness gates
// ---------------------------------------------------------------------------

export const GREEDY_MIN = 0.6;
export const GREEDY_MAX = 0.85;
export const MIN_PERFECT_TOWNS = 3;

/**
 * Weekday ramp, measured: the number of distinct perfect towns must fall inside
 * the band for that weekday. Fewer perfect towns = harder day.
 */
export const PERFECT_BANDS: readonly { min: number; max: number }[] = [
  { min: 200, max: Infinity }, // Monday
  { min: 100, max: Infinity },
  { min: 30, max: 3000 },
  { min: 15, max: 1500 },
  { min: 8, max: 800 },
  { min: MIN_PERFECT_TOWNS, max: 400 },
  { min: MIN_PERFECT_TOWNS, max: 150 }, // Sunday
];

export type DayStats = {
  date: string;
  weekday: string;
  difficulty: number;
  roll: number;
  wishes: number;
  optimum: number;
  perfectCount: number;
  greedyScore: number;
  greedyRatio: number;
  solverNodes: number;
  rejectedRolls: number;
  rejections: Record<GateName, number>;
  gates: Record<GateName, boolean>;
  exampleTown: number[];
  guestId?: string;
};

export type GateName = 'perfectExists' | 'threePerfect' | 'greedyBand' | 'weekdayRamp';

export const GATE_NAMES: readonly GateName[] = ['perfectExists', 'threePerfect', 'greedyBand', 'weekdayRamp'];

export type GateInput = {
  difficulty: number;
  wishes: number;
  optimum: number;
  perfectCount: number;
  greedyScore: number;
};

/** Pure check over recorded numbers, so recorded stats alone prove a day is fair. */
export const checkGates = (s: GateInput): Record<GateName, boolean> => {
  const ratio = s.optimum > 0 ? s.greedyScore / s.optimum : 0;
  const band = PERFECT_BANDS[s.difficulty]!;
  return {
    perfectExists: s.optimum === s.wishes && s.perfectCount >= 1,
    threePerfect: s.perfectCount >= MIN_PERFECT_TOWNS,
    greedyBand: ratio >= GREEDY_MIN && ratio <= GREEDY_MAX,
    weekdayRamp: s.perfectCount >= band.min && s.perfectCount <= band.max,
  };
};

export const MAX_ROLLS = 400;

/** Re-rolls a date until every gate passes. Throws if none does within MAX_ROLLS. */
export const generateDay = (
  date: string,
  guest?: GuestResident
): { puzzle: Puzzle; stats: DayStats } => {
  const rejections: Record<GateName, number> = {
    perfectExists: 0,
    threePerfect: 0,
    greedyBand: 0,
    weekdayRamp: 0,
  };
  for (let roll = 0; roll < MAX_ROLLS; roll++) {
    const puzzle = buildCandidate(date, roll, guest);
    const evaluated = evaluateCandidate(puzzle);
    const gates = checkGates(evaluated);
    const failed = GATE_NAMES.find((g) => !gates[g]);
    if (failed) {
      rejections[failed]++;
      continue;
    }
    const stats: DayStats = {
      date,
      weekday: WEEKDAY_NAMES[puzzle.difficulty]!,
      difficulty: puzzle.difficulty,
      roll,
      wishes: evaluated.wishes,
      optimum: evaluated.optimum,
      perfectCount: evaluated.perfectCount,
      greedyScore: evaluated.greedyScore,
      greedyRatio: Math.round((evaluated.greedyScore / evaluated.optimum) * 1000) / 1000,
      solverNodes: evaluated.nodes,
      rejectedRolls: roll,
      rejections,
      gates,
      exampleTown: evaluated.example,
    };
    if (guest) stats.guestId = guest.id;
    return { puzzle, stats };
  }
  throw new Error(`No fair day found for ${date} within ${MAX_ROLLS} rolls`);
};

export const evaluateCandidate = (puzzle: Puzzle) => {
  const solved = solve(puzzle);
  const greedy = greedyTown(puzzle);
  return {
    difficulty: puzzle.difficulty,
    wishes: solved.total,
    optimum: solved.optimum,
    perfectCount: solved.perfectCount,
    greedyScore: greedy.score,
    nodes: solved.nodes,
    example: solved.example,
  };
};

export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const utcDate = (now: Date = new Date()) => now.toISOString().slice(0, 10);
