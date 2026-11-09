/**
 * Project cards, project facts, the contact support block and the unit filters'
 * fixed ranges read from messages/site-extra.ts. Both languages carry the same
 * keys, and the English one has no Arabic letters.
 */
import { extraT } from '../messages/site-extra';

function shape(v: unknown, path = ''): string[] {
  if (typeof v === 'function') return [path];
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  }
  return [path];
}

describe('site-extra messages', () => {
  it('Arabic and English have the same keys', () => {
    expect(shape(extraT('en')).sort()).toEqual(shape(extraT('ar')).sort());
  });

  it('no English string contains Arabic letters', () => {
    const en = extraT('en');
    expect(JSON.stringify(en)).not.toMatch(/[؀-ۿ]/);
    expect(en.projectFacts.unitsValue('7')).toBe('7 units');
  });
});
