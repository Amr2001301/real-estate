import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import '../globals.css';

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

export const metadata: Metadata = {
  title: 'طباعة المستند',
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${plexArabic.variable}`}>
      <head>
        <style>{`
          @media print {
            @page { margin: 14mm 18mm; size: A4; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          body { background: #fff; color: #0F1E33; }
        `}</style>
      </head>
      <body className="bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
