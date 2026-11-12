import { BUILDING_BY_ID, HAIR_COLOURS, SKIN_TONES, type BuildingId, type LandmarkId } from '../shared/catalog';
import type { ResidentLook } from '../shared/types';

/**
 * Paper-diorama art. Every shape has an ink outline (var(--ink)) and a flat
 * fill, drawn in a 100 x 100 box so it scales from a 300px comment snapshot
 * to a full-width board.
 */

const INK = 'var(--ink)';
const PAPER = 'var(--paper)';
const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const FLAT_ROOF: ReadonlySet<BuildingId> = new Set(['nightclub', 'cinema', 'clinic', 'garage', 'laundromat']);

const Glyph = ({ id }: { id: BuildingId }) => {
  switch (id) {
    case 'bakery':
      return <path d="M36 66 Q50 48 64 66 Q50 60 36 66 Z" fill="#F7D9A0" {...stroke} strokeWidth={3} />;
    case 'bookshop':
      return (
        <g {...stroke} strokeWidth={3}>
          <rect x="36" y="52" width="8" height="18" fill="#F6EFDF" />
          <rect x="46" y="50" width="8" height="20" fill="#E9A23B" />
          <rect x="56" y="54" width="8" height="16" fill="#F6EFDF" />
        </g>
      );
    case 'nightclub':
      return (
        <g {...stroke} strokeWidth={3}>
          <circle cx="50" cy="60" r="10" fill="#D9D3F2" />
          <path d="M40 60 H60 M50 50 V70" />
        </g>
      );
    case 'cafe':
      return (
        <g {...stroke} strokeWidth={3}>
          <path d="M38 54 H58 V64 Q58 70 48 70 Q38 70 38 64 Z" fill="#F6EFDF" />
          <path d="M58 57 Q65 58 58 64" fill="none" />
        </g>
      );
    case 'florist':
      return (
        <g {...stroke} strokeWidth={3}>
          <circle cx="50" cy="58" r="5" fill="#F2C94C" />
          <circle cx="42" cy="58" r="5" fill="#F6EFDF" />
          <circle cx="58" cy="58" r="5" fill="#F6EFDF" />
          <path d="M50 64 V72" />
        </g>
      );
    case 'school':
      return (
        <g {...stroke} strokeWidth={3}>
          <rect x="43" y="56" width="14" height="14" fill="#F6EFDF" />
          <path d="M50 56 V46 H58 V50 H50" fill="#F2C94C" />
        </g>
      );
    case 'clinic':
      return <path d="M45 50 H55 V56 H61 V66 H55 V72 H45 V66 H39 V56 H45 Z" fill="#F6EFDF" {...stroke} strokeWidth={3} />;
    case 'cinema':
      return (
        <g {...stroke} strokeWidth={3}>
          <rect x="36" y="52" width="28" height="16" fill="#F6EFDF" />
          <path d="M41 52 V68 M59 52 V68" />
        </g>
      );
    case 'laundromat':
      return (
        <g {...stroke} strokeWidth={3}>
          <circle cx="50" cy="61" r="10" fill="#F6EFDF" />
          <path d="M44 62 Q50 57 56 62" fill="none" />
        </g>
      );
    case 'musicshop':
      return (
        <g {...stroke} strokeWidth={3}>
          <circle cx="45" cy="67" r="5" fill="#2E2A24" />
          <path d="M50 67 V50 L58 53" fill="none" />
        </g>
      );
    case 'daycare':
      return (
        <g {...stroke} strokeWidth={3}>
          <circle cx="42" cy="53" r="4" fill="#C98E62" />
          <circle cx="58" cy="53" r="4" fill="#C98E62" />
          <circle cx="50" cy="61" r="9" fill="#C98E62" />
        </g>
      );
    case 'garage':
      return <path d="M36 70 V54 H64 V70 M36 59 H64 M36 64 H64" fill="#F6EFDF" {...stroke} strokeWidth={3} />;
  }
};

export const BuildingArt = ({ id, lifted = false }: { id: BuildingId; lifted?: boolean }) => {
  const b = BUILDING_BY_ID[id];
  const flat = FLAT_ROOF.has(id);
  return (
    <g className={lifted ? 'art lifted' : 'art'}>
      {/* paper shadow */}
      <path d={flat ? 'M22 40 H82 V86 H22 Z' : 'M22 44 L52 18 L82 44 V86 H22 Z'} fill="var(--shadow)" transform="translate(4 4)" />
      {flat ? (
        <>
          <rect x="18" y="36" width="64" height="50" fill={b.accent} {...stroke} />
          <rect x="14" y="28" width="72" height="10" fill={PAPER} {...stroke} />
        </>
      ) : (
        <>
          <rect x="22" y="42" width="56" height="44" fill={b.accent} {...stroke} />
          <path d="M14 46 L50 14 L86 46 Z" fill={PAPER} {...stroke} />
        </>
      )}
      <rect x="30" y="46" width="40" height="30" rx="4" fill={PAPER} opacity="0.35" />
      <Glyph id={id} />
    </g>
  );
};

export const LandmarkArt = ({ id }: { id: LandmarkId }) => {
  switch (id) {
    case 'fountain':
      return (
        <g {...stroke}>
          <ellipse cx="50" cy="72" rx="32" ry="12" fill="#9ED3E6" />
          <path d="M50 70 V40" />
          <path d="M50 40 Q38 46 34 60 M50 40 Q62 46 66 60" fill="none" stroke="#3E7CB1" />
        </g>
      );
    case 'oak':
      return (
        <g {...stroke}>
          <path d="M46 86 V60 H54 V86" fill="#8B5A2B" />
          <circle cx="50" cy="44" r="26" fill="#7DAA5B" />
          <circle cx="40" cy="40" r="4" fill="#5E8A42" stroke="none" />
          <circle cx="60" cy="50" r="4" fill="#5E8A42" stroke="none" />
        </g>
      );
    case 'pond':
      return (
        <g {...stroke}>
          <ellipse cx="50" cy="62" rx="36" ry="20" fill="#9ED3E6" />
          <path d="M44 58 Q44 50 52 50 Q58 50 58 56 L64 56 Q60 64 50 64 Q44 64 44 58 Z" fill="#F6EFDF" />
          <path d="M58 52 L64 52" stroke="#E9A23B" />
        </g>
      );
    case 'statue':
      return (
        <g {...stroke}>
          <rect x="34" y="70" width="32" height="14" fill="#C9C1B0" />
          <circle cx="50" cy="32" r="8" fill="#B8B0A0" />
          <path d="M42 70 V44 H58 V70 Z" fill="#B8B0A0" />
          <path d="M58 48 L68 34" />
        </g>
      );
    case 'well':
      return (
        <g {...stroke}>
          <path d="M30 26 L50 14 L70 26 Z" fill="#D9483B" />
          <path d="M34 26 V60 M66 26 V60" />
          <rect x="28" y="58" width="44" height="26" rx="6" fill="#C9C1B0" />
        </g>
      );
  }
};

export type Mood = 'happy' | 'upset' | 'neutral';

export const Face = ({
  look,
  mood,
  size = 40,
  x,
  y,
}: {
  look: ResidentLook;
  mood: Mood;
  size?: number;
  x?: number;
  y?: number;
}) => {
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length];
  const hair = HAIR_COLOURS[look.hair % HAIR_COLOURS.length];
  const hairShape = [
    <path key="h" d="M18 46 Q18 16 50 16 Q82 16 82 46 Q70 30 50 30 Q30 30 18 46 Z" fill={hair} {...stroke} />,
    <g key="h">
      <circle cx="50" cy="14" r="10" fill={hair} {...stroke} />
      <path d="M20 44 Q22 22 50 22 Q78 22 80 44 Q66 32 50 32 Q34 32 20 44 Z" fill={hair} {...stroke} />
    </g>,
    <path key="h" d="M20 40 L28 20 L38 30 L48 16 L58 30 L70 18 L80 40 Q50 28 20 40 Z" fill={hair} {...stroke} />,
    <path key="h" d="M16 74 Q12 18 50 18 Q88 18 84 74 L76 74 Q78 34 50 32 Q22 34 24 74 Z" fill={hair} {...stroke} />,
  ][look.hairStyle % 4];
  const eyes =
    mood === 'happy' ? (
      <path d="M34 52 Q39 46 44 52 M56 52 Q61 46 66 52" fill="none" {...stroke} strokeWidth={3.5} />
    ) : (
      <g fill={INK}>
        <circle cx="39" cy="52" r="3.6" />
        <circle cx="61" cy="52" r="3.6" />
      </g>
    );
  const brows =
    mood === 'upset' ? <path d="M32 42 L45 46 M68 42 L55 46" fill="none" {...stroke} strokeWidth={3} /> : null;
  const mouth =
    mood === 'happy' ? (
      <path d="M38 64 Q50 78 62 64 Z" fill="#B5462E" {...stroke} strokeWidth={3} />
    ) : mood === 'upset' ? (
      <path d="M38 72 Q50 60 62 72" fill="none" {...stroke} strokeWidth={3.5} />
    ) : (
      <path d="M42 68 H58" fill="none" {...stroke} strokeWidth={3.5} />
    );
  const accessory = [
    null,
    <g key="a" fill="none" {...stroke} strokeWidth={2.5}>
      <circle cx="39" cy="52" r="8" />
      <circle cx="61" cy="52" r="8" />
      <path d="M47 52 H53" />
    </g>,
    <path key="a" d="M22 30 H78 L70 14 H30 Z" fill="#3E7CB1" {...stroke} />,
    <path key="a" d="M66 22 L78 16 L78 30 Z M66 22 L56 14 L56 30 Z" fill="#E0679A" {...stroke} strokeWidth={2.5} />,
  ][look.accessory % 4];
  return (
    <svg
      width={size}
      height={size}
      {...(x === undefined ? {} : { x })}
      {...(y === undefined ? {} : { y })}
      viewBox="0 0 100 100"
      className={`face mood-${mood}`}
      role="img"
      aria-label={`${mood} face`}
    >
      <circle cx="50" cy="54" r="32" fill={skin} {...stroke} />
      {mood === 'happy' && <circle cx="30" cy="62" r="5" fill="#E0679A" opacity="0.45" />}
      {mood === 'happy' && <circle cx="70" cy="62" r="5" fill="#E0679A" opacity="0.45" />}
      {hairShape}
      {brows}
      {eyes}
      {mouth}
      {accessory}
    </svg>
  );
};

/** UI icons drawn in SVG so they never depend on an emoji font. */
export const FlameIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="icon-svg">
    <path d="M50 8 Q72 34 70 58 Q70 90 50 92 Q30 90 30 62 Q30 46 42 34 Q42 50 50 54 Q46 30 50 8 Z" fill="#E9634F" {...stroke} strokeWidth={6} />
    <path d="M50 92 Q38 88 40 72 Q44 62 50 58 Q58 66 60 74 Q60 88 50 92 Z" fill="#F2C94C" />
  </svg>
);

export const ClockIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="icon-svg">
    <circle cx="50" cy="54" r="38" fill={PAPER} {...stroke} strokeWidth={8} />
    <path d="M50 54 V32 M50 54 L64 62 M42 8 H58" fill="none" {...stroke} strokeWidth={8} />
  </svg>
);
