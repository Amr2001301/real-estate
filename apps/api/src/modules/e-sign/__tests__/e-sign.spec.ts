import { canonicalJson, maskPhone } from '../e-sign.service';

describe('e-sign helpers', () => {
  it('canonicalJson: the same content hashes alike whatever its key order', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 'x' } })).toBe(
      canonicalJson({ a: { c: 'x', d: [1, { x: 1, y: 2 }] }, b: 1 }),
    );
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
  });

  it('maskPhone shows enough to recognise the number, not to read it', () => {
    expect(maskPhone('+201001234567')).toBe('+20 ••• ••• 4567');
    expect(maskPhone('+201001234567')).not.toContain('100123');
  });
});
