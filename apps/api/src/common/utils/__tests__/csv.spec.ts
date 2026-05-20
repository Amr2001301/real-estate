import { toCsv, csvFilename, type CsvCell } from '../csv';

const BOM = '﻿';

describe('csv util', () => {
  describe('toCsv', () => {
    it('prefixes the output with a UTF-8 BOM (Excel Arabic support)', () => {
      const out = toCsv(['a'], [['1']]);
      expect(out.startsWith(BOM)).toBe(true);
    });

    it('joins header + rows with CRLF line endings (RFC 4180)', () => {
      const out = toCsv(['h1', 'h2'], [['a', 'b']]);
      expect(out).toBe(`${BOM}h1,h2\r\na,b`);
    });

    it('quotes cells containing a comma', () => {
      const out = toCsv(['x'], [['a,b']]);
      expect(out).toBe(`${BOM}x\r\n"a,b"`);
    });

    it('escapes embedded double-quotes by doubling them', () => {
      const out = toCsv(['x'], [['she said "hi"']]);
      expect(out).toBe(`${BOM}x\r\n"she said ""hi"""`);
    });

    it('quotes cells containing newlines (LF and CRLF)', () => {
      const lf = toCsv(['x'], [['line1\nline2']]);
      expect(lf).toBe(`${BOM}x\r\n"line1\nline2"`);
      const crlf = toCsv(['x'], [['line1\r\nline2']]);
      expect(crlf).toBe(`${BOM}x\r\n"line1\r\nline2"`);
    });

    it('passes Arabic text through unquoted when it has no delimiters', () => {
      const out = toCsv(['المؤشر', 'القيمة'], [['عدد العقود', '12']]);
      expect(out).toBe(`${BOM}المؤشر,القيمة\r\nعدد العقود,12`);
    });

    it('renders null/undefined as empty cells', () => {
      const rows: CsvCell[][] = [[null, undefined, 'x']];
      const out = toCsv(['a', 'b', 'c'], rows);
      expect(out).toBe(`${BOM}a,b,c\r\n,,x`);
    });

    it('stringifies numbers and booleans', () => {
      const out = toCsv(['n', 'b'], [[42, true]]);
      expect(out).toBe(`${BOM}n,b\r\n42,true`);
    });

    it('handles an empty row set (headers only)', () => {
      const out = toCsv(['only-header'], []);
      expect(out).toBe(`${BOM}only-header`);
    });
  });

  describe('csvFilename', () => {
    it('appends an ISO date stamp and the .csv extension', () => {
      const name = csvFilename('sales-report');
      expect(name).toMatch(/^sales-report-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('replaces unsafe characters with underscores', () => {
      const name = csvFilename('a/b c:d');
      expect(name).toMatch(/^a_b_c_d-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });
});
