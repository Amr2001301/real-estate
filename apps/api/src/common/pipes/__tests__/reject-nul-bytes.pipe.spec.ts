import { BadRequestException } from '@nestjs/common';
import { RejectNulBytesPipe } from '../reject-nul-bytes.pipe';

// QA run 1, F-045: a NUL in a public form field was a 500 and left a lead behind.
describe('RejectNulBytesPipe', () => {
  const pipe = new RejectNulBytesPipe();

  it('lets ordinary text, Arabic, emoji and other control characters through', () => {
    const body = { name: 'سارة 😀', message: 'سطر\nجديد\tوتاب', n: 5, ok: true, nothing: null, list: ['a', { b: 'c' }] };
    expect(pipe.transform(body)).toBe(body);
  });

  it('refuses a NUL in a string, in a nested object, in an array and in a key', () => {
    expect(() => pipe.transform('a\u0000b')).toThrow(BadRequestException);
    expect(() => pipe.transform({ message: 'x\u0000y' })).toThrow(BadRequestException);
    expect(() => pipe.transform({ a: { b: [{ c: 'z\u0000' }] } })).toThrow(BadRequestException);
    expect(() => pipe.transform({ ['k\u0000']: 'v' })).toThrow(BadRequestException);
  });

  it('does not loop on very deep input', () => {
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 50; i++) deep = { n: deep };
    expect(() => pipe.transform(deep)).not.toThrow();
  });
});
