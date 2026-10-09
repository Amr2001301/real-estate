import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import { printT } from '@/messages/print';

// The root layout already sets lang/dir from the dashboard language. This
// layout used to render a second <html>/<body> inside it (invalid nesting —
// hydration errors, and the root `overflow: hidden` cut long documents off
// after one screen). It now only lifts that scroll lock and adds A4 rules.

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: printT(locale).common.print };
}

/** CSS string literal (page-number labels go into `content:`). */
const cssString = (s: string) => JSON.stringify(s);

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const t = printT(await getLocale()).common;
  const pageLabel = `${cssString(`${t.page} `)} counter(page) ${cssString(` ${t.of} `)} counter(pages)`;

  return (
    <>
      <style>{`
        html, body { height: auto !important; overflow: visible !important; }
        html { color-scheme: light; }
        @media print {
          @page {
            size: A4;
            margin: 14mm 16mm 16mm;
            @bottom-center { content: ${pageLabel}; font-size: 8pt; color: #94A3B8; }
          }
          body { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </>
  );
}
