'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { PremiumFilterField } from '@/components/premium/filter-bar';
import { intlLocale } from '@/lib/format';
import type { CompareMode, PeriodMode } from '@/lib/report-filter';
import type { Locale } from '@/lib/locale';

// ── Month labels ──────────────────────────────────────────────────────────────
const MONTHS_AR = [
  { v: '1', l: 'يناير' },   { v: '2',  l: 'فبراير' },
  { v: '3', l: 'مارس' },    { v: '4',  l: 'أبريل' },
  { v: '5', l: 'مايو' },    { v: '6',  l: 'يونيو' },
  { v: '7', l: 'يوليو' },   { v: '8',  l: 'أغسطس' },
  { v: '9', l: 'سبتمبر' },  { v: '10', l: 'أكتوبر' },
  { v: '11', l: 'نوفمبر' }, { v: '12', l: 'ديسمبر' },
];

const MONTHS_EN = [
  { v: '1', l: 'January' },   { v: '2',  l: 'February' },
  { v: '3', l: 'March' },     { v: '4',  l: 'April' },
  { v: '5', l: 'May' },       { v: '6',  l: 'June' },
  { v: '7', l: 'July' },      { v: '8',  l: 'August' },
  { v: '9', l: 'September' }, { v: '10', l: 'October' },
  { v: '11', l: 'November' }, { v: '12', l: 'December' },
];

// ── Quarter labels ────────────────────────────────────────────────────────────
const QUARTERS_AR = [
  { v: '1', l: 'الربع الأول (يناير – مارس)' },
  { v: '2', l: 'الربع الثاني (أبريل – يونيو)' },
  { v: '3', l: 'الربع الثالث (يوليو – سبتمبر)' },
  { v: '4', l: 'الربع الرابع (أكتوبر – ديسمبر)' },
];

const QUARTERS_EN = [
  { v: '1', l: 'Q1 (January – March)' },
  { v: '2', l: 'Q2 (April – June)' },
  { v: '3', l: 'Q3 (July – September)' },
  { v: '4', l: 'Q4 (October – December)' },
];

function buildYears() {
  const y = new Date().getFullYear();
  // 3 years back + current + 1 ahead
  return Array.from({ length: 5 }, (_, i) => y + 1 - i);
}
const YEARS = buildYears();

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ReportFilterBarProps {
  defaultMode: PeriodMode;
  defaultMonth: number;
  defaultYear: number;
  defaultQuarter: number;
  defaultDateFrom: string;
  defaultDateTo: string;
  defaultCompare: CompareMode;
  basePath: string;
  locale?: Locale;
}

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * The reports filter (U5): period as a segmented control, then year / month /
 * comparison as `label · value` pills; it applies on every change (no Apply
 * button) and writes the chosen range out at the end.
 */
export function ReportFilterBar({
  defaultMode,
  defaultMonth,
  defaultYear,
  defaultQuarter,
  defaultDateFrom,
  defaultDateTo,
  defaultCompare,
  basePath,
  locale = 'ar',
}: ReportFilterBarProps) {
  const router = useRouter();
  const [state, setState] = useState({
    mode: defaultMode,
    month: defaultMonth,
    year: defaultYear,
    quarter: defaultQuarter,
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo,
    compare: defaultCompare,
  });
  const isAr = locale === 'ar';

  function go(patch: Partial<typeof state>) {
    const next = { ...state, ...patch };
    setState(next);
    if (next.mode === 'custom' && (!next.dateFrom || !next.dateTo)) return;
    const p = new URLSearchParams();
    p.set('mode', next.mode);
    p.set('year', String(next.year));
    if (next.mode === 'monthly') p.set('month', String(next.month));
    if (next.mode === 'quarterly') p.set('quarter', String(next.quarter));
    if (next.mode === 'custom') {
      p.set('dateFrom', next.dateFrom);
      p.set('dateTo', next.dateTo);
    }
    if (next.compare !== 'none') p.set('compare', next.compare);
    router.push(`${basePath}?${p.toString()}`);
  }

  const MODE_LABEL: Record<PeriodMode, string> = isAr
    ? { monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي', custom: 'مخصص' }
    : { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', custom: 'Custom' };
  const MONTHS = isAr ? MONTHS_AR : MONTHS_EN;
  const QUARTERS = isAr ? QUARTERS_AR : QUARTERS_EN;
  const COMPARE: Array<[CompareMode, string]> = isAr
    ? [['none', 'بدون'], ['previous-period', 'الفترة السابقة'], ['previous-month', 'الشهر السابق'], ['yoy', 'العام السابق']]
    : [['none', 'None'], ['previous-period', 'Previous period'], ['previous-month', 'Previous month'], ['yoy', 'Last year']];

  // "1 – 31 October 2026" — the range the page is showing.
  let rangeText = '';
  try {
    const from = new Date(`${defaultDateFrom}T00:00:00Z`);
    const to = new Date(`${defaultDateTo}T00:00:00Z`);
    rangeText = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .formatRange(from, to);
  } catch {
    rangeText = `${defaultDateFrom} – ${defaultDateTo}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[28px] border border-hairline bg-surface p-2 sm:p-2.5 shadow-[0_10px_30px_-18px_rgb(20_26_38/0.25)]">
      <div role="radiogroup" aria-label={isAr ? 'نوع الفترة' : 'Period type'} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken/60 p-1">
        {(Object.keys(MODE_LABEL) as PeriodMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={state.mode === m}
            onClick={() => go({ mode: m })}
            className={
              state.mode === m
                ? 'h-10 rounded-full bg-surface px-5 text-[14px] font-bold text-slate-900 shadow-sm'
                : 'h-10 rounded-full px-5 text-[14px] text-slate-600 hover:text-slate-900'
            }
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {state.mode !== 'custom' && (
        <PremiumFilterField neutral label={isAr ? 'السنة' : 'Year'} htmlFor="rf-year">
          <Select id="rf-year" inputSize="sm" value={state.year} onChange={(e) => go({ year: Number(e.target.value) })}>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </PremiumFilterField>
      )}
      {state.mode === 'monthly' && (
        <PremiumFilterField neutral label={isAr ? 'الشهر' : 'Month'} htmlFor="rf-month">
          <Select id="rf-month" inputSize="sm" value={state.month} onChange={(e) => go({ month: Number(e.target.value) })}>
            {MONTHS.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </Select>
        </PremiumFilterField>
      )}
      {state.mode === 'quarterly' && (
        <PremiumFilterField neutral label={isAr ? 'الربع' : 'Quarter'} htmlFor="rf-quarter">
          <Select id="rf-quarter" inputSize="sm" value={state.quarter} onChange={(e) => go({ quarter: Number(e.target.value) })}>
            {QUARTERS.map((q) => (
              <option key={q.v} value={q.v}>{q.l}</option>
            ))}
          </Select>
        </PremiumFilterField>
      )}
      {state.mode === 'custom' && (
        <>
          <PremiumFilterField neutral label={isAr ? 'من' : 'From'} htmlFor="rf-from">
            <input id="rf-from" type="date" value={state.dateFrom} onChange={(e) => go({ dateFrom: e.target.value })} />
          </PremiumFilterField>
          <PremiumFilterField neutral label={isAr ? 'إلى' : 'To'} htmlFor="rf-to">
            <input id="rf-to" type="date" value={state.dateTo} onChange={(e) => go({ dateTo: e.target.value })} />
          </PremiumFilterField>
        </>
      )}
      <PremiumFilterField neutral label={isAr ? 'المقارنة' : 'Compare'} htmlFor="rf-compare">
        <Select id="rf-compare" inputSize="sm" value={state.compare} onChange={(e) => go({ compare: e.target.value as CompareMode })}>
          {COMPARE.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </PremiumFilterField>

      <span className="ms-auto pe-3 text-[13px] text-slate-500">{rangeText}</span>
    </div>
  );
}
