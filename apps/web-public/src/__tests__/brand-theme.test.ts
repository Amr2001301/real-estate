import { brandThemeVars } from '@/lib/branding';

const channels = (css: string, name: string) => new RegExp(`--${name}:(\\d+) (\\d+) (\\d+)`).exec(css)?.slice(1, 4).map(Number);

describe('brandThemeVars', () => {
  it('gives nothing when the company set no colour (the site keeps its defaults)', () => {
    expect(brandThemeVars(undefined, undefined)).toBeNull();
    expect(brandThemeVars('not-a-colour', '#12')).toBeNull();
  });

  it('writes the navy and gold scales from the company colours', () => {
    const css = brandThemeVars('#064E3B', '#EC4899')!;
    expect(channels(css, 'c-navy')).toEqual([6, 78, 59]);
    // The accent is kept unless it would not stand out on the primary (then lightened).
    expect(channels(css, 'c-gold-400')![0]).toBeGreaterThanOrEqual(236);
    expect(brandThemeVars('#064E3B', '#F5D76E')).toContain('--c-gold-400:245 215 110');
    for (const k of ['c-navy-700', 'c-navy-600', 'c-gold-50', 'c-gold-100', 'c-gold-200', 'c-gold-300', 'c-gold-500', 'c-gold-600', 'c-gold-700']) {
      expect(channels(css, k)).toHaveLength(3);
    }
  });

  it('darkens a light primary so white text still reads on it', () => {
    const css = brandThemeVars('#FFFFFF', undefined)!;
    const [r, g, b] = channels(css, 'c-navy')!;
    expect(0.2126 * r! + 0.7152 * g! + 0.0722 * b!).toBeLessThan(110);
  });

  it('lightens an accent that would vanish on the primary', () => {
    const css = brandThemeVars('#0F1E33', '#0F1E34')!;
    const [r, g, b] = channels(css, 'c-gold-400')!;
    expect(r! + g! + b!).toBeGreaterThan(300);
  });

  it('changes only the scale it was given', () => {
    expect(brandThemeVars('#064E3B', undefined)).not.toMatch(/c-gold/);
    expect(brandThemeVars(undefined, '#EC4899')).not.toMatch(/c-navy/);
  });
});
