import { BUILDINGS, LANDMARKS, LANDMARK_IDS, type BuildingId, type LandmarkId } from './catalog';
import type { GuestResident, GuestWish, RuleType } from './types';

/**
 * Community resident grammar. Replies to the pinned prompt look like:
 *
 *   Marta the florist: Put my florist on a corner. Keep the nightclub away from my door.
 *
 * Name (letters only, 2-14 chars), "the" + a building or its owner's job, a colon,
 * then one or two wishes using the same 12 rule types the game already knows.
 */
export const SUGGESTION_FORMAT = 'Name the building: wish. wish.';
export const SUGGESTION_EXAMPLE =
  'Marta the florist: Put my florist on a corner. Keep the nightclub away from my door.';

export type ParseResult = { ok: true; guest: Omit<GuestResident, 'id' | 'creditedTo'> } | { ok: false; reason: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const BUILDING_WORDS: { word: string; id: BuildingId }[] = BUILDINGS.flatMap((b) => [
  { word: b.name.toLowerCase().replace('é', 'e'), id: b.id },
  { word: b.name.toLowerCase(), id: b.id },
  { word: b.owner.toLowerCase(), id: b.id },
  { word: b.id, id: b.id },
]).sort((a, b) => b.word.length - a.word.length);

const LANDMARK_WORDS: { word: string; id: LandmarkId }[] = LANDMARK_IDS.flatMap((id) => [
  { word: LANDMARKS[id].name, id },
  { word: id, id },
]).sort((a, b) => b.word.length - a.word.length);

const buildingAlt = BUILDING_WORDS.map((w) => escape(w.word)).join('|');
const landmarkAlt = LANDMARK_WORDS.map((w) => escape(w.word)).join('|');

const findBuilding = (text: string): BuildingId | undefined =>
  BUILDING_WORDS.find((w) => w.word === text.trim().toLowerCase())?.id;

type Pattern = { type: RuleType; re: RegExp; needs: 'none' | 'building' | 'landmark' };

/** Order matters: negative and far forms are tried before plain "next to". */
const PATTERNS: Pattern[] = [
  { type: 'quiet', re: /\b(no neighbou?rs|peace and quiet|nothing (right )?next to)\b/, needs: 'none' },
  { type: 'farFrom', re: new RegExp(`\\b(?:keep )?the (${buildingAlt})\\b.*\\bfar\\b|\\bfar (?:away )?from the (${buildingAlt})\\b`), needs: 'building' },
  { type: 'notAdjacent', re: new RegExp(`\\b(?:keep )?the (${buildingAlt})\\b.*\\baway from\\b|\\b(?:not|n't|never)\\b.*\\b(?:next to|beside)\\b.*\\bthe (${buildingAlt})\\b|\\b(?:don't|do not) put the (${buildingAlt}) next to`), needs: 'building' },
  { type: 'byLandmark', re: new RegExp(`\\b(?:next to|beside|by) the (${landmarkAlt})\\b`), needs: 'landmark' },
  { type: 'adjacent', re: new RegExp(`\\b(?:next to|beside|by) the (${buildingAlt})\\b`), needs: 'building' },
  { type: 'sameRow', re: new RegExp(`\\bthe (${buildingAlt}) on my street\\b|\\bsame street as the (${buildingAlt})\\b`), needs: 'building' },
  { type: 'sameColumn', re: new RegExp(`\\bsame column as the (${buildingAlt})\\b|\\bline (?:me|my \\w+) up with the (${buildingAlt})\\b`), needs: 'building' },
  { type: 'northOf', re: new RegExp(`\\bnorth of the (${buildingAlt})\\b`), needs: 'building' },
  { type: 'corner', re: /\bcorner\b/, needs: 'none' },
  { type: 'mainStreet', re: /\bmain street\b/, needs: 'none' },
  { type: 'inland', re: /\b(middle of (things|town)|inside town|town centre|town center)\b/, needs: 'none' },
  { type: 'edge', re: /\bedge\b/, needs: 'none' },
];

export const parseWish = (sentence: string): GuestWish | null => {
  const s = sentence.toLowerCase().replace(/é/g, 'e').replace(/’/g, "'").trim();
  for (const p of PATTERNS) {
    const m = p.re.exec(s);
    if (!m) continue;
    const captured = m.slice(1).find((g) => g !== undefined);
    if (p.needs === 'none') return { type: p.type };
    if (p.needs === 'landmark') {
      const id = LANDMARK_WORDS.find((w) => w.word === captured)?.id;
      return id ? { type: p.type, landmark: id } : null;
    }
    const other = captured ? findBuilding(captured) : undefined;
    return other ? { type: p.type, other } : null;
  }
  return null;
};

export const parseSuggestion = (raw: string): ParseResult => {
  const text = raw.replace(/\s+/g, ' ').trim();
  const head = /^([A-Za-z][A-Za-z'-]{1,13}),? (?:the )?([A-Za-zé ]{2,20}?)\s*:\s*(.+)$/.exec(text);
  if (!head) return { ok: false, reason: `Use the format: ${SUGGESTION_FORMAT}` };
  const [, rawName, rawBuilding, rest] = head;
  const building = findBuilding(rawBuilding!);
  if (!building) return { ok: false, reason: `Unknown building "${rawBuilding}"` };
  const sentences = rest!
    .split(/[.!;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0 || sentences.length > 2) return { ok: false, reason: 'Give one or two wishes' };
  const wishes: GuestWish[] = [];
  for (const sentence of sentences) {
    const wish = parseWish(sentence);
    if (!wish) return { ok: false, reason: `Could not read the wish "${sentence}"` };
    if (wish.other === building) return { ok: false, reason: 'A wish must name a different building' };
    wishes.push(wish);
  }
  const name = rawName!.charAt(0).toUpperCase() + rawName!.slice(1).toLowerCase();
  return { ok: true, guest: { name, building, wishes } };
};
