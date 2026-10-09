import type { CSSProperties, ReactNode } from 'react';
import { tx } from '@/lib/format';
import type { Letterhead } from '@/lib/letterhead';
import type { Locale } from '@/lib/locale';
import { printT } from '@/messages/print';
import { PrintToolbar } from './PrintToolbar';

// A4 company documents: letterhead from the company branding (logo, colours,
// contact, commercial registration), amounts in the company currency, text in
// the dashboard language. Colours come in as CSS variables so every block
// below follows the tenant's brand.

const DEFAULT_PRIMARY = '#0F1E33';
const DEFAULT_ACCENT = '#C8A24B';

export type PrintTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<PrintTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

/** Amounts on documents keep their halalas/piastres: no rounding away of decimals. */
export function formatMoney(
  value: string | number | null | undefined,
  currency: string,
  locale: Locale,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  const digits = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat(locale === 'en' ? 'en-EG' : 'ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Plain numbers (area, floor, months) in the document's digits. */
export function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(locale === 'en' ? 'en-EG' : 'ar-EG');
}

/** The company name a document is issued by. */
export function companyNameOf(letterhead: Letterhead, locale: Locale): string {
  return letterhead.displayName || letterhead.name || printT(locale).common.fallbackCompany;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = '', second = ''] = words;
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}

function text(value: unknown, locale: Locale): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'ar' in value) return tx(value as { ar: string; en: string }, locale);
  return '';
}

export function PrintDocument({
  letterhead,
  locale,
  eyebrow,
  title,
  reference,
  date,
  status,
  watermark,
  note,
  children,
}: {
  letterhead: Letterhead;
  locale: Locale;
  /** Small label above the title (e.g. "Receipt"). */
  eyebrow: string;
  title: string;
  reference?: string | null;
  date: string;
  status?: { label: string; tone: PrintTone };
  /** Large faint word across every page — for void / cancelled documents. */
  watermark?: string;
  note?: string;
  children: ReactNode;
}) {
  const t = printT(locale).common;
  const company = companyNameOf(letterhead, locale);
  const tagline = text(letterhead.tagline, locale);
  const address = text(letterhead.contactAddress, locale);
  const brand: CSSProperties = {
    ['--brand' as string]: letterhead.primaryColor || DEFAULT_PRIMARY,
    ['--accent' as string]: letterhead.accentColor || DEFAULT_ACCENT,
  };

  const contact = [
    letterhead.contactPhone && { label: t.phone, value: letterhead.contactPhone, ltr: true },
    letterhead.contactEmail && { label: t.email, value: letterhead.contactEmail, ltr: true },
    address && { label: t.address, value: address, ltr: false },
    letterhead.registrationNumber && { label: t.registration, value: letterhead.registrationNumber, ltr: true },
  ].filter(Boolean) as { label: string; value: string; ltr: boolean }[];

  return (
    <div style={brand} className="min-h-screen bg-slate-100 print:bg-white">
      <PrintToolbar title={title} printLabel={t.print} closeLabel={t.close} hint={t.hint} />

      {watermark && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
        >
          <span className="-rotate-[30deg] select-none text-[120px] font-black tracking-widest text-red-600/[0.07]">
            {watermark}
          </span>
        </div>
      )}

      <div className="px-3 pb-10 pt-20 print:p-0">
        <article
          data-testid="print-document"
          className="relative z-10 mx-auto max-w-[210mm] bg-white px-[16mm] py-[14mm] shadow-xl ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0"
        >
          {/* ── Letterhead ── */}
          <header className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              {letterhead.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={letterhead.logoUrl}
                  alt={company}
                  className="h-14 w-auto max-w-[150px] object-contain"
                />
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  {initials(company)}
                </div>
              )}
              <div className="min-w-0">
                <div
                  data-testid="print-company"
                  className="truncate text-xl font-bold leading-tight"
                  style={{ color: 'var(--brand)' }}
                >
                  {company}
                </div>
                {tagline && <div className="mt-0.5 truncate text-xs text-slate-500">{tagline}</div>}
              </div>
            </div>

            <div className="shrink-0 text-end">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'var(--accent)' }}
              >
                {eyebrow}
              </div>
              <h1 className="mt-1 text-2xl font-bold leading-tight" style={{ color: 'var(--brand)' }}>
                {title}
              </h1>
            </div>
          </header>

          <div className="mt-5 h-[3px] rounded-full" style={{ background: 'var(--brand)' }} />
          <div className="mt-[2px] h-px" style={{ background: 'var(--accent)' }} />

          {/* ── Document meta ── */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MetaBox label={t.reference}>
              <span dir="ltr" className="font-mono">{reference || '—'}</span>
            </MetaBox>
            <MetaBox label={t.issuedOn}>{date}</MetaBox>
            <MetaBox label={t.status}>
              {status ? (
                <span
                  data-testid="print-status"
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[status.tone]}`}
                >
                  {status.label}
                </span>
              ) : (
                '—'
              )}
            </MetaBox>
          </div>

          {/* ── Body ── */}
          <main className="mt-2">{children}</main>

          {note && (
            <p
              className="mt-8 border-s-2 ps-3 text-[11px] leading-relaxed text-slate-500"
              style={{ borderColor: 'var(--accent)' }}
            >
              {note}
            </p>
          )}

          {/* ── Footer ── */}
          <footer className="mt-10 border-t border-slate-200 pt-3 text-[10.5px] text-slate-500">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="font-semibold" style={{ color: 'var(--brand)' }}>{company}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {contact.map((c) => (
                  <span key={c.label}>
                    <span className="text-slate-400">{c.label}: </span>
                    <span dir={c.ltr ? 'ltr' : undefined}>{c.value}</span>
                  </span>
                ))}
              </span>
            </div>
            <div className="mt-1.5 text-slate-400">{t.generated(date)}</div>
          </footer>
        </article>
      </div>
    </div>
  );
}

function MetaBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-800">{children}</div>
    </div>
  );
}

/** A titled block inside a document. */
export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 break-inside-avoid">
      <h2
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'var(--brand)' }}
      >
        <span className="h-3.5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export interface PrintField {
  label: string;
  value: ReactNode;
  /** Span both columns (long values such as notes). */
  wide?: boolean;
  ltr?: boolean;
}

/** Falsy entries are skipped, so rows can be written as `cond && {...}`. */
type Maybe<T> = T | null | undefined | false | '' | 0;

/** Label / value pairs in two columns; empty values are dropped. */
export function PrintFields({ items }: { items: Maybe<PrintField>[] }) {
  const shown = items.filter(
    (i): i is PrintField => !!i && i.value !== null && i.value !== undefined && i.value !== '',
  );
  return (
    <dl className="grid grid-cols-2 gap-x-8">
      {shown.map((f) => (
        <div
          key={f.label}
          className={`flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 ${f.wide ? 'col-span-2' : ''}`}
        >
          <dt className="shrink-0 text-xs text-slate-500">{f.label}</dt>
          <dd className="text-end text-sm font-medium text-slate-900" dir={f.ltr ? 'ltr' : undefined}>
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Side-by-side cards for the parties to a document. */
export function PrintParties({
  parties,
}: {
  parties: { role: string; name: string; lines: (string | null | undefined)[] }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {parties.map((p) => (
        <div key={p.role} className="rounded-xl border border-slate-200 p-4">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--accent)' }}
          >
            {p.role}
          </div>
          <div className="mt-1.5 text-base font-bold text-slate-900">{p.name}</div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            {p.lines.filter(Boolean).map((l) => (
              <div key={l!}>{l}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Money summary — the emphasized row is the headline figure. */
export function PrintAmounts({
  rows,
}: {
  rows: Maybe<{ label: string; value: string; emphasis?: boolean }>[];
}) {
  const shown = rows.filter((r): r is { label: string; value: string; emphasis?: boolean } => !!r);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {shown.map((r, i) =>
        r.emphasis ? (
          <div
            key={r.label}
            data-testid="print-amount-total"
            className="flex items-center justify-between gap-4 px-4 py-3 text-white"
            style={{ background: 'var(--brand)' }}
          >
            <span className="text-sm font-semibold">{r.label}</span>
            <span className="text-lg font-bold">{r.value}</span>
          </div>
        ) : (
          <div
            key={r.label}
            className={`flex items-center justify-between gap-4 px-4 py-2.5 text-sm ${i % 2 ? 'bg-slate-50/70' : ''}`}
          >
            <span className="text-slate-500">{r.label}</span>
            <span className="font-semibold text-slate-900">{r.value}</span>
          </div>
        ),
      )}
    </div>
  );
}

/** A compact table (installment schedules). */
export function PrintTable({
  head,
  rows,
  align,
  foot,
}: {
  head: string[];
  rows: ReactNode[][];
  /** Per-column alignment; amounts read best end-aligned. */
  align?: ('start' | 'end')[];
  foot?: ReactNode[];
}) {
  const cls = (i: number) => (align?.[i] === 'end' ? 'text-end' : 'text-start');
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b-2" style={{ borderColor: 'var(--accent)' }}>
          {head.map((h, i) => (
            <th key={h} className={`px-2 py-2 font-semibold text-slate-500 ${cls(i)}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className={`break-inside-avoid border-b border-slate-100 ${ri % 2 ? 'bg-slate-50/60' : ''}`}>
            {r.map((c, ci) => (
              <td key={ci} className={`px-2 py-1.5 text-slate-800 ${cls(ci)}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>
            {foot.map((c, i) => (
              <td key={i} className={`px-2 py-2 ${cls(i)}`}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** Signature blocks for each party, plus a stamp box for the company. */
export function PrintSignatures({
  locale,
  parties,
}: {
  locale: Locale;
  parties: { role: string; name: string }[];
}) {
  const t = printT(locale).common;
  return (
    <section className="mt-12 grid break-inside-avoid grid-cols-3 gap-6">
      {parties.map((p) => (
        <div key={p.role}>
          <div className="text-xs font-bold" style={{ color: 'var(--brand)' }}>{p.role}</div>
          <div className="mt-1 text-xs text-slate-500">
            {t.name}: <span className="text-slate-800">{p.name}</span>
          </div>
          <div className="mt-8 border-b border-dashed border-slate-300" />
          <div className="mt-1 text-[10px] text-slate-400">{t.signature}</div>
          <div className="mt-5 border-b border-dashed border-slate-300" />
          <div className="mt-1 text-[10px] text-slate-400">{t.date}</div>
        </div>
      ))}
      <div className="flex items-center justify-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-center text-[10px] text-slate-400">
          {t.stamp}
        </div>
      </div>
    </section>
  );
}
