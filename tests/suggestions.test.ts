import { describe, expect, it } from 'vitest';
import { parseSuggestion, parseWish, SUGGESTION_EXAMPLE } from '../src/shared/suggestions';

describe('community resident grammar', () => {
  it('parses the example from the pinned prompt', () => {
    const r = parseSuggestion(SUGGESTION_EXAMPLE);
    expect(r).toEqual({
      ok: true,
      guest: { name: 'Marta', building: 'florist', wishes: [{ type: 'corner' }, { type: 'notAdjacent', other: 'nightclub' }] },
    });
  });

  it.each([
    ['I want to wake up next to the bakery', { type: 'adjacent', other: 'bakery' }],
    ['Keep the nightclub far from my baby', { type: 'farFrom', other: 'nightclub' }],
    ['Keep the garage away from my door', { type: 'notAdjacent', other: 'garage' }],
    ["Don't put the cinema next to my shop", { type: 'notAdjacent', other: 'cinema' }],
    ['Put me on the same street as the café', { type: 'sameRow', other: 'cafe' }],
    ['Same column as the school please', { type: 'sameColumn', other: 'school' }],
    ['I must live north of the clinic', { type: 'northOf', other: 'clinic' }],
    ['Put me beside the old oak', { type: 'byLandmark', landmark: 'oak' }],
    ['next to the fountain!', { type: 'byLandmark', landmark: 'fountain' }],
    ['No neighbours', { type: 'quiet' }],
    ['Main Street or nothing', { type: 'mainStreet' }],
    ['In the middle of things', { type: 'inland' }],
    ['Edge of town', { type: 'edge' }],
    ['A corner lot', { type: 'corner' }],
  ])('"%s"', (text, expected) => {
    expect(parseWish(text)).toEqual(expected);
  });

  it('credits the right building from a job title', () => {
    const r = parseSuggestion('Bo the DJ: Main Street or nothing.');
    expect(r.ok && r.guest.building).toBe('nightclub');
  });

  it.each([
    ['hello there', /format/],
    ['Zed the astronaut: Put me on a corner.', /Unknown building/],
    ['Zed the baker: I like turtles.', /Could not read/],
    ['Zed the baker: corner. edge. main street.', /one or two/],
    ['Zed the baker: Put me next to the bakery.', /different building/],
  ])('rejects "%s"', (text, reason) => {
    const r = parseSuggestion(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });
});
