import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import './fonts.css';
import './globals.css';
import { buildMetadata } from '@/lib/seo';
import { getLocale } from '@/lib/locale';
import { brandThemeVars, fetchBranding } from '@/lib/branding';
import { fetchPageLinks } from '@/lib/cms';
import { DEFAULT_CURRENCY } from '@/lib/site-currency';
import { CurrencyProvider } from '@/components/currency/CurrencyProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { SiteLocaleProvider } from '@/components/locale/SiteLocaleProvider';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { CompanyContactProvider } from '@/components/contact/CompanyContactProvider';
import { companyContact } from '@/lib/contact';
import { PageViewTracker } from '@/components/analytics/PageViewTracker';
import { UtmCapture } from '@/components/analytics/UtmCapture';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Inter (Latin), IBM Plex Sans Arabic, and Tajawal for cinematic headings —
// served from public/fonts (fonts.css), not downloaded at build time.

async function getResolvedSlug(): Promise<string> {
  const h = await headers();
  return h.get('x-resolved-tenant-slug') ?? '';
}

// generateMetadata and RootLayout both call fetchBranding(slug).
// Next.js Request Memoization deduplicates the fetch within one server render,
// so there is at most one network call per request regardless of how many
// components request the same URL.
export async function generateMetadata(): Promise<Metadata> {
  const [locale, slug] = await Promise.all([getLocale(), getResolvedSlug()]);
  const branding = slug ? await fetchBranding(slug) : null;
  return buildMetadata({ branding: branding ?? undefined, locale, root: true });
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, slug] = await Promise.all([getLocale(), getResolvedSlug()]);
  const [branding, pages] = slug ? await Promise.all([fetchBranding(slug), fetchPageLinks(slug, locale)]) : [null, []];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // Build inline CSS only when the tenant supplies at least one colour.
  // globals.css provides fallbacks (navy / gold-400) so brand-* utilities always
  // resolve even when no <style> tag is emitted.
  const cssOverrides = brandThemeVars(branding?.primaryColor, branding?.accentColor) ?? '';

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
    >
      <head>
        {/* A ternary, not `&&`: an empty cssOverrides would render an empty
            text node in <head>, which React 19.3 rejects as a hydration error. */}
        {cssOverrides ? (
          // SSR-rendered so there is no flash: variables are present before
          // any paint. dangerouslySetInnerHTML is safe here — cssOverrides is
          // built from validated hex values parsed server-side.
          <style dangerouslySetInnerHTML={{ __html: `:root{${cssOverrides}}` }} />
        ) : null}
      </head>
      <body className="min-h-full">
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
            </Script>
          </>
        ) : null}
        <PageViewTracker />
        <UtmCapture />
        <ThemeProvider>
          <SiteLocaleProvider locale={locale}>
          <CurrencyProvider currency={branding?.currency ?? DEFAULT_CURRENCY}>
          <FavoritesProvider>
          <CompanyContactProvider contact={companyContact(branding)}>
            <Navbar locale={locale} branding={branding ?? undefined} />
            <main className="min-h-screen">{children}</main>
            <Footer locale={locale} branding={branding ?? undefined} pages={pages} />
            <ChatWidget locale={locale} />
          </CompanyContactProvider>
          </FavoritesProvider>
          </CurrencyProvider>
          </SiteLocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
