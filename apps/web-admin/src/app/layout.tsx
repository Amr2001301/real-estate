import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import './fonts.css';
import './globals.css';
import { ThemeScript } from '@/components/ui/theme-script';

// U5 type: Almarai for text, Noto Naskh Arabic for headings, Cormorant
// Garamond for large numbers (lining numerals) — served from public/fonts
// (fonts.css), the variables set in globals.css.

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
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
