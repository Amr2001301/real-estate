/**
 * @jest-environment node
 *
 * A company's site speaks as the company (QA, dark-mode review of شركة النيل):
 * the home page said «لماذا ديفورا» / «حمّل تطبيق ديفورا» and showed a phone
 * with the platform's logo; the card was cream in dark mode with a heading that
 * vanished into it.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileAppPromo } from '@/components/marketing/MobileAppPromo';
import { companyApp } from '@/lib/app-links';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';
import type { BrandingData } from '@/lib/branding';

const branding = { slug: 'nile', name: 'Real Estate Platform', displayName: 'شركة النيل للتطوير العقاري' } as unknown as BrandingData;
const PLATFORM = /ديفورا|Devora/i;

describe('companyApp', () => {
  it('is null until the company has its own app in a store', () => {
    expect(companyApp(undefined)).toBeNull();
    expect(companyApp(null)).toBeNull();
    expect(companyApp({ name: 'النيل' })).toBeNull();
  });
  it('carries the company app, its name and links', () => {
    expect(companyApp({ name: ' النيل ', playStoreUrl: 'https://play.test/x' })).toEqual({
      name: 'النيل',
      appStore: null,
      googlePlay: 'https://play.test/x',
    });
    expect(companyApp({ appStoreUrl: 'https://apps.test/x' })?.name).toBeNull();
  });
});

describe('the home page copy names the company, not the platform', () => {
  it.each(['ar', 'en'] as const)('%s: the pills and the assistant carry no platform name', (locale) => {
    const s = siteT(locale);
    expect(s.home.why.eyebrow).not.toMatch(PLATFORM);
    expect(s.chat.assistantName).not.toMatch(PLATFORM);
  });
  it.each(['ar', 'en'] as const)('%s: the app promo takes the app name', (locale) => {
    const p = extraT(locale).mobilePromo;
    expect(`${p.badge}${p.titleA}${p.titleB}${p.body}${p.scan}${p.alt}`).not.toMatch(PLATFORM);
    expect(p.badge).toContain('{app}');
    expect(p.titleA).toContain('{app}');
  });
});

describe('MobileAppPromo', () => {
  const html = renderToStaticMarkup(
    createElement(MobileAppPromo, { locale: 'ar', appName: 'تطبيق النيل', branding }),
  );

  it("shows the company's app name and never the platform's name or phone picture", () => {
    expect(html).toContain('تطبيق النيل');
    expect(html).not.toMatch(PLATFORM);
    expect(html).not.toContain('mobile-transparent.png');
  });

  it('turns into a dark card in dark mode so its heading stays readable', () => {
    expect(html).toContain('dark:bg-surface');
    expect(html).toContain('dark:border-hairline');
  });
});
