import { companyMarkKind } from '@/lib/company-mark';
import { initials } from '@/lib/initials';
import type { BrandingData } from '@/lib/branding';

/** F-005: a company without a logo showed the platform's mark beside its name. */
const branding = (extra: object) => ({ slug: 'x', name: 'شركة', ...extra }) as unknown as BrandingData;

describe('companyMarkKind', () => {
  it('a company with a logo shows it', () => {
    expect(companyMarkKind(branding({ logoUrl: 'http://cdn.test/logo.png' }))).toBe('logo');
  });
  it('a company without a logo shows its initials — never the platform mark', () => {
    expect(companyMarkKind(branding({}))).toBe('initials');
    expect(companyMarkKind(branding({ logoUrl: '' }))).toBe('initials');
  });
  it('the platform mark only when there is no company at all', () => {
    expect(companyMarkKind(undefined)).toBe('platform');
  });
});

describe('initials (the company mark)', () => {
  it('first letters of the first and last word, skipping the article «ال»', () => {
    expect(initials('مجموعة الريادة العقارية')).toBe('مع');
    expect(initials('النخبة')).toBe('ن');
  });
});
