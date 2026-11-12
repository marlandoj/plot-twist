/** Frozen day-one content: buildings, landmarks, resident looks, street names. */

export type BuildingId =
  | 'bakery'
  | 'bookshop'
  | 'nightclub'
  | 'cafe'
  | 'florist'
  | 'school'
  | 'clinic'
  | 'cinema'
  | 'laundromat'
  | 'musicshop'
  | 'daycare'
  | 'garage';

export type BuildingDef = {
  id: BuildingId;
  name: string;
  /** Used in the text-and-emoji town map that goes into comments. */
  emoji: string;
  /** One accent colour per building type. */
  accent: string;
  /** What the owner calls it in a wish: "my bookshop". */
  owner: string;
};

export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'bakery', name: 'Bakery', emoji: '🥐', accent: '#E9A23B', owner: 'baker' },
  { id: 'bookshop', name: 'Bookshop', emoji: '📚', accent: '#3E7CB1', owner: 'bookseller' },
  { id: 'nightclub', name: 'Nightclub', emoji: '🪩', accent: '#8E4FC2', owner: 'DJ' },
  { id: 'cafe', name: 'Café', emoji: '☕', accent: '#8B5A2B', owner: 'barista' },
  { id: 'florist', name: 'Florist', emoji: '💐', accent: '#E0679A', owner: 'florist' },
  { id: 'school', name: 'School', emoji: '🏫', accent: '#D9483B', owner: 'teacher' },
  { id: 'clinic', name: 'Clinic', emoji: '🏥', accent: '#2BA39B', owner: 'doctor' },
  { id: 'cinema', name: 'Cinema', emoji: '🎬', accent: '#3B3F8F', owner: 'projectionist' },
  { id: 'laundromat', name: 'Laundromat', emoji: '🧺', accent: '#5FB0D9', owner: 'launderer' },
  { id: 'musicshop', name: 'Music Shop', emoji: '🎸', accent: '#D4762C', owner: 'luthier' },
  { id: 'daycare', name: 'Daycare', emoji: '🧸', accent: '#F2C94C', owner: 'nanny' },
  { id: 'garage', name: 'Garage', emoji: '🔧', accent: '#6E7B5B', owner: 'mechanic' },
];

export const BUILDING_BY_ID: Record<BuildingId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b])
) as Record<BuildingId, BuildingDef>;

export const isBuildingId = (value: string): value is BuildingId => value in BUILDING_BY_ID;

export type LandmarkId = 'fountain' | 'oak' | 'pond' | 'statue' | 'well';

export const LANDMARKS: Record<LandmarkId, { name: string; emoji: string }> = {
  fountain: { name: 'fountain', emoji: '⛲' },
  oak: { name: 'old oak', emoji: '🌳' },
  pond: { name: 'duck pond', emoji: '🦆' },
  statue: { name: 'statue', emoji: '🗽' },
  well: { name: 'wishing well', emoji: '🪣' },
};
export const LANDMARK_IDS = Object.keys(LANDMARKS) as LandmarkId[];

export const FIRST_NAMES = [
  'Ottilie', 'Bram', 'Juno', 'Femi', 'Rosa', 'Ike', 'Mabel', 'Tomas', 'Priya', 'Wren',
  'Hugo', 'Noor', 'Delia', 'Kofi', 'Ines', 'Arlo', 'Sunny', 'Marguerite', 'Lev', 'Pip',
  'Agnes', 'Rafa', 'Yuki', 'Bea', 'Cass', 'Dot', 'Emeka', 'Fern', 'Gus', 'Hattie',
] as const;

/** Rows are streets, north (top) to south (bottom). The bottom row is Main Street. */
export const STREET_NAMES = ['Hill Lane', 'Elm Street', 'Mill Road', 'Main Street'] as const;

export const SKIN_TONES = ['#F6D2B8', '#E8B48F', '#C98E62', '#9C6644', '#6B4430'] as const;
export const HAIR_COLOURS = ['#2B2118', '#6B3E26', '#C8A15A', '#B5462E', '#9A9A9A', '#3A3F6B'] as const;
