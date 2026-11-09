import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { cleanPersonName } from '../clean-person-name';

describe('cleanPersonName (F-046)', () => {
  it('removes bidi overrides and isolates', () => {
    expect(cleanPersonName('Ali‮evil')).toBe('Alievil');
    expect(cleanPersonName('⁦Mona⁩')).toBe('Mona');
  });

  it('removes zero-width spaces and the byte-order mark', () => {
    expect(cleanPersonName('A​hmed﻿')).toBe('Ahmed');
  });

  it('keeps what Arabic and Persian writing needs', () => {
    const arabic = 'أحمد‏ محمد';
    expect(cleanPersonName(arabic)).toBe(arabic);
    expect(cleanPersonName('می‌خواهم')).toBe('می‌خواهم');
  });

  it('collapses whitespace and leaves non-strings alone', () => {
    expect(cleanPersonName('  Omar   Hassan ')).toBe('Omar Hassan');
    expect(cleanPersonName(undefined)).toBeUndefined();
    expect(cleanPersonName(5)).toBe(5);
  });
});
