import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic, Tajawal } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { buildMetadata } from '@/lib/seo';
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

export const metadata: Metadata = buildMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${inter.variable} ${plexArabic.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
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
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
            <ChatWidget />
          </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
