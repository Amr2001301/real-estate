import { toCsv } from '../csv';

describe('toCsv — formula injection', () => {
  const cell = (v: string | number) => toCsv(['h'], [[v]]).split('\r\n')[1];

  it('neutralises text that Excel would run as a formula', () => {
    expect(cell('=HYPERLINK("http://x","click")')).toBe('"\'=HYPERLINK(""http://x"",""click"")"');
    expect(cell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(cell('-2+3+cmd|calc')).toBe("'-2+3+cmd|calc");
  });

  it('leaves numbers and phone numbers alone', () => {
    expect(cell('+201001234567')).toBe('+201001234567');
    expect(cell(-5)).toBe('-5');
    expect(cell('-5')).toBe('-5');
    expect(cell('أحمد')).toBe('أحمد');
  });
});
