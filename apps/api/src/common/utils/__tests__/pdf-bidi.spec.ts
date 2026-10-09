import { bidi } from '../pdf';

/**
 * PDFKit has no bidi algorithm: an Arabic string is laid out right-to-left with
 * the `rtla` feature, which would mirror digits and Latin inside it. bidi()
 * pre-reverses those runs so they come out the right way round.
 */
describe('PDF Arabic text (bidi)', () => {
  it('leaves text without Arabic untouched', () => {
    expect(bidi('Acme Brokers', { width: 10 })).toEqual(['Acme Brokers', { width: 10 }]);
    expect(bidi('43%')).toEqual(['43%', {}]);
  });

  it('lays Arabic out RTL, keeps numbers and codes readable', () => {
    const [text, opts] = bidi('320,000 ج.م');
    expect(opts.features).toEqual(['rtla']);
    expect(text).toBe('؜000,023 ج.م');

    const [note] = bidi('العملة: ج.م (EGP)');
    expect(note).toBe('\u061C' + 'العملة: ج.م )PGE(');
  });

  it('a Latin-first mixed string still takes the Arabic path', () => {
    const [text, opts] = bidi('Devora · تقرير');
    expect(text.startsWith('؜')).toBe(true);
    expect(opts.features).toEqual(['rtla']);
  });
});

describe('PDF Arabic text — phones', () => {
  it('keeps a leading + with its number', () => {
    const [text] = bidi('الهاتف +20 2 2614 5500');
    expect(text).toBe('؜' + 'الهاتف 0055 4162 2 02+');
  });
});
