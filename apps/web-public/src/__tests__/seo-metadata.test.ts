import { buildMetadata } from '@/lib/seo';
import type { BrandingData } from '@/lib/branding';

/**
 * QA F-009 / F-054: every page of every company's site said «· ديفورا» in its
 * tab and shared the platform's image. A page now says only what is its own; the
 * root layout (which knows the tenant) carries the company's name, image and the
 * title template.
 */
const riyada = {
  slug: 'riyada',
  name: 'مجموعة الريادة العقارية',
  displayName: 'مجموعة الريادة العقارية',
  ogImageUrl: 'http://cdn.test/riyada-og.png',
  faviconUrl: 'http://cdn.test/riyada-fav.png',
} as unknown as BrandingData;

describe('buildMetadata', () => {
  it('root: the company name is the title template and the og image is the company\'s', () => {
    const m = buildMetadata({ branding: riyada, root: true, locale: 'ar' });
    expect(m.title).toEqual({ default: expect.stringContaining('مجموعة الريادة العقارية'), template: '%s · مجموعة الريادة العقارية' });
    expect(JSON.stringify(m.openGraph)).toContain('riyada-og.png');
    expect(JSON.stringify(m.openGraph)).not.toContain('ديفورا');
    expect(JSON.stringify(m.icons)).toContain('riyada-fav.png');
  });

  it('a page without branding writes only its own title — never the platform name or image', () => {
    const m = buildMetadata({ title: 'المشاريع' });
    expect(m.title).toBe('المشاريع');
    expect(JSON.stringify(m)).not.toContain('ديفورا');
    expect(JSON.stringify(m)).not.toContain('og-default');
    expect(m.openGraph).toBeUndefined();
    expect(m.icons).toBeUndefined();
  });

  it('a page keeps its own cover image and path', () => {
    const m = buildMetadata({ title: 'برج الأفق', path: '/projects/1', image: 'http://cdn.test/cover.png' });
    expect(JSON.stringify(m.openGraph)).toContain('cover.png');
    expect(JSON.stringify(m.openGraph)).not.toContain('og-default');
    expect(m.alternates).toEqual({ canonical: '/projects/1' });
  });

  it('a page that has the company branding is absolute, with the company name', () => {
    const m = buildMetadata({ title: 'المشاريع', branding: riyada });
    expect(m.title).toEqual({ absolute: 'المشاريع · مجموعة الريادة العقارية' });
  });

  it('a company with no share image or favicon uses its logo, never the platform mark', () => {
    const noOg = { slug: 'x', name: 'شركة', logoUrl: 'http://cdn.test/logo.png' } as unknown as BrandingData;
    const m = buildMetadata({ branding: noOg, root: true });
    expect(JSON.stringify(m.openGraph)).toContain('logo.png');
    expect(JSON.stringify(m.openGraph)).not.toContain('og-default');
    expect(JSON.stringify(m.icons)).toContain('logo.png');
  });
});
