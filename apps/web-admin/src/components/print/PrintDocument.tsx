'use client';

import { useEffect } from 'react';

interface PrintDocumentProps {
  title: string;
  companyName: string;
  documentType: string;
  referenceNumber?: string | null;
  date: string;
  children: React.ReactNode;
  footer?: string;
}

/** Triggers window.print() automatically once the component mounts. */
function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function PrintDocument({
  title,
  companyName,
  documentType,
  referenceNumber,
  date,
  children,
  footer,
}: PrintDocumentProps) {
  return (
    <>
      <AutoPrint />

      {/* Print action bar — hidden when printing */}
      <div className="no-print fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-slate-900 px-6 py-3 text-sm text-white shadow-lg">
        <span className="font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            طباعة / تنزيل PDF
          </button>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Page content — padded to clear the print bar on screen */}
      <div className="pt-16 print:pt-0">
        <div className="mx-auto max-w-[800px] px-6 py-8 print:px-0 print:py-0">

          {/* ── Letterhead ── */}
          <header className="mb-8 border-b-2 border-[#C8A24B] pb-6">
            <div className="flex items-start justify-between">
              {/* Company identity */}
              <div>
                <div
                  className="mb-1 text-2xl font-bold tracking-tight"
                  style={{ color: '#0F1E33' }}
                >
                  {companyName}
                </div>
                <div className="text-sm" style={{ color: '#64748B' }}>
                  {documentType}
                </div>
              </div>

              {/* Document meta */}
              <div className="text-left text-sm" style={{ color: '#64748B' }}>
                {referenceNumber && (
                  <div className="font-mono font-bold" style={{ color: '#0F1E33' }}>
                    #{referenceNumber}
                  </div>
                )}
                <div>{date}</div>
              </div>
            </div>
          </header>

          {/* ── Body ── */}
          <main>{children}</main>

          {/* ── Footer ── */}
          <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-xs" style={{ color: '#94A3B8' }}>
            {footer ?? `${companyName} — ${date}`}
          </footer>
        </div>
      </div>
    </>
  );
}

/** A labeled data row for print documents. */
export function PrintRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  if (value == null || value === '') return null;
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 ${highlight ? 'font-semibold' : ''}`}
    >
      <span className="shrink-0 text-sm" style={{ color: '#64748B' }}>{label}</span>
      <span
        className={`text-end text-sm ${highlight ? 'text-amber-700' : ''}`}
        style={{ color: highlight ? undefined : '#0F1E33' }}
      >
        {value}
      </span>
    </div>
  );
}

/** A section heading inside a print document. */
export function PrintSection({ title }: { title: string }) {
  return (
    <h2
      className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.13em]"
      style={{ color: '#C8A24B' }}
    >
      {title}
    </h2>
  );
}
