import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic, Tajawal } from 'next/font/google';
import { headers } from 'next/headers';
import Script from 'next/script';
import './globals.css';
import { buildMetadata } from '@/lib/seo';
import { getLocale } from '@/lib/locale';
import { fetchBranding, hexToRgbVars } from '@/lib/branding';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { PageViewTracker } from '@/components/analytics/PageViewTracker';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

// Display face for cinematic headings (premium, geometric Arabic).
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

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
  return buildMetadata({ branding: branding ?? undefined, locale });
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, slug] = await Promise.all([getLocale(), getResolvedSlug()]);
  const branding = slug ? await fetchBranding(slug) : null;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // Build inline CSS only when the tenant supplies at least one colour.
  // globals.css provides fallbacks (navy / gold-400) so brand-* utilities always
  // resolve even when no <style> tag is emitted.
  const primaryVars = branding?.primaryColor ? hexToRgbVars(branding.primaryColor) : null;
  const accentVars  = branding?.accentColor  ? hexToRgbVars(branding.accentColor)  : null;
  const cssOverrides = [
    primaryVars ? `--c-brand-primary:${primaryVars}` : null,
    accentVars  ? `--c-brand-accent:${accentVars}`   : null,
  ].filter(Boolean).join(';');

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${plexArabic.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        {cssOverrides && (
          // SSR-rendered so there is no flash: variables are present before
          // any paint. dangerouslySetInnerHTML is safe here — cssOverrides is
          // built from validated hex values parsed server-side.
          <style dangerouslySetInnerHTML={{ __html: `:root{${cssOverrides}}` }} />
        )}
      </head>
      <body className="min-h-full">
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
            </Script>
          </>
        )}
        <PageViewTracker />
        <ThemeProvider>
          <FavoritesProvider>
            <Navbar locale={locale} branding={branding ?? undefined} />
            <main className="min-h-screen">{children}</main>
            <Footer locale={locale} branding={branding ?? undefined} />
            <ChatWidget />
          </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
