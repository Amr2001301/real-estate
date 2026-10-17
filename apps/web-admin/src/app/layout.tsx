import type { Metadata } from 'next';
import { Almarai, Cormorant_Garamond, Noto_Naskh_Arabic } from 'next/font/google';
import { getLocale } from '@/lib/locale';
import './globals.css';
import { ThemeScript } from '@/components/ui/theme-script';

// U5 type: Almarai for text, Noto Naskh Arabic for headings, Cormorant
// Garamond for large numbers (lining numerals).
const almarai = Almarai({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-numeric',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Devora Admin',
  description: 'Admin dashboard for Devora',
  icons: { icon: '/favicon.ico' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${almarai.variable} ${naskh.variable} ${cormorant.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
