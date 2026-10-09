/**
 * Tiny CSV builder. RFC 4180 escaping plus a UTF-8 BOM so Excel opens Arabic
 * cells without mojibake. Intentionally dependency-free — we don't need a full
 * csv library for the small report exports we ship.
 */

const BOM = '﻿';

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Quote when the cell contains a delimiter, quote, or line break.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return BOM + lines.join('\r\n');
}

/**
 * Several CSV blocks (title lines, `toCsv` tables, blank separators) as one
 * file: a single BOM at the very start. Each `toCsv` table carries its own,
 * which mid-file would land as an invisible character inside the first
 * header cell of every later section.
 */
export function csvSections(parts: string[]): string {
  return BOM + parts.map((p) => p.split(BOM).join('')).join('\r\n');
}

export function csvFilename(base: string): string {
  const safe = base.replace(/[^\w.-]+/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safe}-${stamp}.csv`;
}
