import { expect, test } from '@playwright/test';
import { initials } from '../src/lib/initials';

// QA run 1, F-048 / F-010: five copies of this helper split an emoji in two
// (a hydration error) and used the article «ال» as the initial.
test.describe('initials()', () => {
  test('first letter of the first and the last word', () => {
    expect(initials('سارة محمود')).toBe('سم');
    expect(initials('Marwan Elsherif')).toBe('ME');
  });

  test('skips the Arabic article', () => {
    expect(initials('مها السيد')).toBe('مس');
    expect(initials('رامي الشريف')).toBe('رش');
  });

  test('a name that starts with an emoji is never split inside it', () => {
    expect(initials('😀👨‍👩‍👧 سارة')).toBe('س');
    for (const n of ['😀 سارة', '👨‍👩‍👧', '😀😀😀']) {
      const s = initials(n);
      // no lone surrogate (it renders as U+FFFD and differs server / client)
      expect(s).not.toMatch(/[\uD800-\uDFFF]/);
    }
  });

  test('words that do not start with a letter are ignored', () => {
    expect(initials('E2E Visitor 1792')).toBe('EV');
    expect(initials('— ')).toBe('؟');
  });

  test('one word: one letter, or two when asked', () => {
    expect(initials('سارة')).toBe('س');
    expect(initials('سارة', { single: 2 })).toBe('سا');
    expect(initials('السيد', { single: 2 })).toBe('سي');
  });

  test('empty gives the fallback', () => {
    expect(initials('')).toBe('؟');
    expect(initials(undefined, { fallback: '·' })).toBe('·');
    expect(initials('   ', { fallback: '·' })).toBe('·');
  });
});
