import { PAPER, type FilledField, type PaperSize } from '@/lib/form-layout';
import type { Locale } from '@/lib/locale';
import { printT } from '@/messages/print';
import { FormOverlay } from './FormOverlay';
import { PrintToolbar, type TemplateSwitcher } from './PrintToolbar';

/**
 * A document printed on the company's own paper form: each page full-bleed
 * on its own sheet of the form's size, the values where the company placed them.
 */
export function FormPrint({
  title,
  locale,
  pages,
  fields,
  paperSize = 'A4',
  switcher,
  watermark,
}: {
  title: string;
  locale: Locale;
  pages: { imageUrl: string }[];
  fields: FilledField[];
  paperSize?: PaperSize;
  switcher?: TemplateSwitcher;
  watermark?: string;
}) {
  const t = printT(locale).common;
  const paper = PAPER[paperSize] ?? PAPER.A4;
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintToolbar title={title} printLabel={t.print} closeLabel={t.close} hint={t.hint} switcher={switcher} />
      <style>{`@media print { @page { size: ${paper.css}; margin: 0; } }`}</style>
      {watermark && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <span className="-rotate-[30deg] select-none whitespace-nowrap text-[110px] font-black tracking-widest text-red-600/[0.09]">
            {watermark}
          </span>
        </div>
      )}
      <div className="px-3 pb-10 pt-20 print:p-0">
        <FormOverlay
          pages={pages}
          fields={fields}
          paperSize={paperSize}
          className="mx-auto flex flex-col gap-6 print:max-w-none print:gap-0"
          style={{ maxWidth: `${paper.w}mm` }}
          pageClassName="shadow-xl ring-1 ring-slate-200 print:break-after-page print:shadow-none print:ring-0"
        />
      </div>
    </div>
  );
}
