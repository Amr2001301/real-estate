/**
 * The sign-in screens read every string from messages/auth.ts. Both languages
 * must carry the same keys (and the same number of list items), so a string
 * added to one cannot silently fall back to nothing in the other.
 */
import { authT } from '../messages/auth';

function shape(v: unknown, path = ''): string[] {
  if (Array.isArray(v)) return [`${path}[${v.length}]`];
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  }
  return [path];
}

describe('auth messages', () => {
  it('Arabic and English have the same keys', () => {
    expect(shape(authT('en')).sort()).toEqual(shape(authT('ar')).sort());
  });

  it('no English string contains Arabic letters', () => {
    const flat = JSON.stringify(authT('en'));
    expect(flat).not.toMatch(/[؀-ۿ]/);
  });
});
