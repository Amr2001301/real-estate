import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Dark mode is a fixed neutral charcoal for every company: the company's colour
 * lives on its headers, buttons and accents, not in the page background (a
 * green or red primary on a navy canvas looked mismatched).
 */
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const darkBlock = /\.dark\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const rgb = (name: string): [number, number, number] => {
  const m = new RegExp(`--${name}:\\s*(\\d+) (\\d+) (\\d+)`).exec(darkBlock);
  if (!m) throw new Error(`--${name} missing in .dark`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const spread = (c: [number, number, number]) => Math.max(...c) - Math.min(...c);

describe('dark mode surfaces', () => {
  const surfaces = ['c-canvas', 'c-surface', 'c-surface-soft', 'c-hairline'] as const;

  it('are neutral — no company or platform hue in the page background', () => {
    for (const s of surfaces) expect(spread(rgb(s))).toBeLessThanOrEqual(10);
  });

  it('step up from the canvas: canvas < recessed < raised card < border', () => {
    const l = surfaces.map((s) => lum(rgb(s)));
    expect(l[0]!).toBeLessThan(l[2]!);
    expect(l[2]!).toBeLessThan(l[1]!);
    expect(l[1]!).toBeLessThan(l[3]!);
  });

  it('keep body and muted text readable on every surface', () => {
    for (const s of ['c-canvas', 'c-surface', 'c-surface-soft'] as const) {
      expect(contrast(rgb('c-ink'), rgb(s))).toBeGreaterThanOrEqual(10);
      expect(contrast(rgb('c-ink-muted'), rgb(s))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
