'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
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

  const [mode, setMode]       = useState<PeriodMode>(defaultMode);
  const [month, setMonth]     = useState(defaultMonth);
  const [year, setYear]       = useState(defaultYear);
  const [quarter, setQuarter] = useState(defaultQuarter);
  const [dateFrom, setFrom]   = useState(defaultDateFrom);
  const [dateTo, setTo]       = useState(defaultDateTo);
  const [compare, setCompare] = useState<CompareMode>(defaultCompare);

  const isAr = locale === 'ar';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    p.set('mode', mode);
    p.set('year', String(year));
    if (mode === 'monthly')   p.set('month',   String(month));
    if (mode === 'quarterly') p.set('quarter', String(quarter));
    if (mode === 'custom') {
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo)   p.set('dateTo',   dateTo);
    }
    if (compare !== 'none') p.set('compare', compare);
    router.push(`${basePath}?${p.toString()}`);
  }

  const MODE_LABEL: Record<PeriodMode, string> = isAr
    ? { monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي', custom: 'نطاق مخصص' }
    : { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', custom: 'Custom range' };

  const MONTHS   = isAr ? MONTHS_AR   : MONTHS_EN;
  const QUARTERS = isAr ? QUARTERS_AR : QUARTERS_EN;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 shadow-xs"
    >
      {/* Icon */}
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <CalendarDays className="h-3.5 w-3.5" />
      </span>

      {/* Divider */}
      <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

      {/* Period mode */}
      <Select
        inputSize="sm"
        value={mode}
        onChange={(e) => setMode(e.target.value as PeriodMode)}
        className="w-36"
        aria-label={isAr ? 'نوع الفترة' : 'Period type'}
      >
        {(Object.keys(MODE_LABEL) as PeriodMode[]).map((m) => (
          <option key={m} value={m}>{MODE_LABEL[m]}</option>
        ))}
      </Select>

      {/* Year — shown for monthly / quarterly / yearly */}
      {mode !== 'custom' && (
        <Select
          inputSize="sm"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-24"
          aria-label={isAr ? 'السنة' : 'Year'}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      )}

      {/* Month — only for monthly */}
      {mode === 'monthly' && (
        <Select
          inputSize="sm"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="w-36"
          aria-label={isAr ? 'الشهر' : 'Month'}
        >
          {MONTHS.map((m) => (
            <option key={m.v} value={m.v}>{m.l}</option>
          ))}
        </Select>
      )}

      {/* Quarter — only for quarterly */}
      {mode === 'quarterly' && (
        <Select
          inputSize="sm"
          value={quarter}
          onChange={(e) => setQuarter(Number(e.target.value))}
          className="w-56"
          aria-label={isAr ? 'الربع' : 'Quarter'}
        >
          {QUARTERS.map((q) => (
            <option key={q.v} value={q.v}>{q.l}</option>
          ))}
        </Select>
      )}

      {/* Custom date range */}
      {mode === 'custom' && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0">{isAr ? 'من' : 'From'}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 rounded-lg border border-hairline bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors"
              aria-label={isAr ? 'من تاريخ' : 'From date'}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0">{isAr ? 'إلى' : 'To'}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 rounded-lg border border-hairline bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors"
              aria-label={isAr ? 'إلى تاريخ' : 'To date'}
            />
          </div>
        </>
      )}

      {/* Divider */}
      <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

      {/* Comparison mode */}
      <Select
        inputSize="sm"
        value={compare}
        onChange={(e) => setCompare(e.target.value as CompareMode)}
        className="w-48"
        aria-label={isAr ? 'وضع المقارنة' : 'Comparison mode'}
      >
        {isAr ? (
          <>
            <option value="none">بدون مقارنة</option>
            <option value="previous-period">الفترة السابقة</option>
            <option value="previous-month">الشهر السابق</option>
            <option value="yoy">نفس الفترة من العام السابق</option>
          </>
        ) : (
          <>
            <option value="none">No comparison</option>
            <option value="previous-period">Previous period</option>
            <option value="previous-month">Previous month</option>
            <option value="yoy">Same period last year</option>
          </>
        )}
      </Select>

      {/* Apply */}
      <Button type="submit" variant="primary" size="sm" className="ms-auto shrink-0">
        {isAr ? 'تطبيق' : 'Apply'}
      </Button>
    </form>
  );
}
