import type { BuildingId, LandmarkId } from './catalog';

/** The 12 frozen wish rule types. */
export type RuleType =
  | 'adjacent'
  | 'notAdjacent'
  | 'corner'
  | 'edge'
  | 'sameRow'
  | 'farFrom'
  | 'sameColumn'
  | 'inland'
  | 'northOf'
  | 'byLandmark'
  | 'quiet'
  | 'mainStreet';

/**
 * A wish always concerns the speaker's own building (slot `a`).
 * Pair rules also name another building slot `b`; byLandmark names a landmark.
 */
export type Wish = {
  type: RuleType;
  a: number;
  b?: number;
  landmark?: LandmarkId;
  /** Which phrasing template to voice the wish with. */
  phrasing: number;
};

export type ResidentLook = {
  skin: number;
  hair: number;
  hairStyle: number;
  accessory: number;
};

export type Resident = {
  name: string;
  /** Slot index of the building this resident owns and lives above. */
  home: number;
  look: ResidentLook;
  wishes: Wish[];
  /** Set when a community member suggested this resident. */
  creditedTo?: string;
};

export type Landmark = { id: LandmarkId; cell: number };

export type Puzzle = {
  date: string;
  roll: number;
  /** 0 = Monday (easiest) ... 6 = Sunday (hardest). */
  difficulty: number;
  landmarks: Landmark[];
  /** Exactly 5 building types; slot i is owned by residents[i]. */
  buildings: BuildingId[];
  residents: Resident[];
};

/** Cell index per building slot, or -1 when not yet placed. */
export type Placement = number[];

export type WishStatus = 'met' | 'broken' | 'pending';

/** A community resident approved by the operator. Wishes use building ids, not slots. */
export type GuestResident = {
  id: string;
  name: string;
  building: BuildingId;
  wishes: GuestWish[];
  creditedTo: string;
};

export type GuestWish = {
  type: RuleType;
  other?: BuildingId;
  landmark?: LandmarkId;
};

/** What travels in the Reddit post's postData (well under the 2 KB limit). */
export type DayPostData = {
  game: 'plot-twist';
  date: string;
  roll: number;
  guest?: GuestResident;
};
