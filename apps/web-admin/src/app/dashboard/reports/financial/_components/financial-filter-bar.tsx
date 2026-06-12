'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { CompareMode, PeriodMode } from '@/lib/report-filter';

const MONTHS_AR = [
  { v: '1',  l: 'يناير' },   { v: '2',  l: 'فبراير' },
  { v: '3',  l: 'مارس' },    { v: '4',  l: 'أبريل' },
  { v: '5',  l: 'مايو' },    { v: '6',  l: 'يونيو' },
  { v: '7',  l: 'يوليو' },   { v: '8',  l: 'أغسطس' },
  { v: '9',  l: 'سبتمبر' },  { v: '10', l: 'أكتوبر' },
  { v: '11', l: 'نوفمبر' },  { v: '12', l: 'ديسمبر' },
];

const QUARTERS_AR = [
  { v: '1', l: 'الربع الأول (يناير – مارس)' },
  { v: '2', l: 'الربع الثاني (أبريل – يونيو)' },
  { v: '3', l: 'الربع الثالث (يوليو – سبتمبر)' },
  { v: '4', l: 'الربع الرابع (أكتوبر – ديسمبر)' },
];

function buildYears(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => y + 1 - i);
}
const YEARS = buildYears();

const DATE_CLS =
  'h-8 rounded-lg border border-hairline bg-white px-2.5 text-xs text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors';

const MODE_LABEL: Record<PeriodMode, string> = {
  monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي', custom: 'نطاق مخصص',
};

export interface FinancialFilterBarProps {
  defaultMode: PeriodMode;
  defaultMonth: number;
  defaultYear: number;
  defaultQuarter: number;
  defaultDateFrom: string;
  defaultDateTo: string;
  defaultCompare: CompareMode;
  defaultProjectId?: string;
  defaultQ?: string;
  defaultType?: string;
  defaultShowFilters?: boolean;
  projects: { id: string; name: string }[];
}

export function FinancialFilterBar({
  defaultMode, defaultMonth, defaultYear, defaultQuarter,
  defaultDateFrom, defaultDateTo, defaultCompare,
  defaultProjectId = '', defaultQ = '', defaultType = '',
  defaultShowFilters = false,
  projects,
}: FinancialFilterBarProps) {
  const router = useRouter();

  const [mode,        setMode]        = useState<PeriodMode>(defaultMode);
  const [month,       setMonth]       = useState(defaultMonth);
  const [year,        setYear]        = useState(defaultYear);
  const [quarter,     setQuarter]     = useState(defaultQuarter);
  const [dateFrom,    setFrom]        = useState(defaultDateFrom);
  const [dateTo,      setTo]          = useState(defaultDateTo);
  const [compare,     setCompare]     = useState<CompareMode>(defaultCompare);
  const [showFilters, setShowFilters] = useState(defaultShowFilters);
  const [projectId,   setProjectId]   = useState(defaultProjectId);
  const [q,           setQ]           = useState(defaultQ);
  const [type,        setType]        = useState(defaultType);

  const hasAdvanced = !!(projectId || q || type);

  function buildParams(opts: { clearAdvanced?: boolean } = {}): URLSearchParams {
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
    if (!opts.clearAdvanced) {
      if (projectId) p.set('projectId', projectId);
      if (q)         p.set('q',         q);
      if (type)      p.set('type',      type);
    }
    // Persist panel state across submits
    if (showFilters && !opts.clearAdvanced) p.set('showFilters', '1');
    return p;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/dashboard/reports/financial?${buildParams().toString()}`);
  }

  function handleClear() {
    setProjectId('');
    setQ('');
    setType('');
    router.push(`/dashboard/reports/financial?${buildParams({ clearAdvanced: true }).toString()}`);
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
      <form onSubmit={handleSubmit}>

        {/* ── Main filter row ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Period mode */}
          <Select
            inputSize="sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as PeriodMode)}
            className="w-36"
            aria-label="نوع الفترة"
          >
            {(Object.keys(MODE_LABEL) as PeriodMode[]).map((m) => (
              <option key={m} value={m}>{MODE_LABEL[m]}</option>
            ))}
          </Select>

          {/* Year (not shown in custom mode) */}
          {mode !== 'custom' && (
            <Select
              inputSize="sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24"
              aria-label="السنة"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          )}

          {/* Month (monthly mode) */}
          {mode === 'monthly' && (
            <Select
              inputSize="sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-36"
              aria-label="الشهر"
            >
              {MONTHS_AR.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </Select>
          )}

          {/* Quarter (quarterly mode) */}
          {mode === 'quarterly' && (
            <Select
              inputSize="sm"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className="w-56"
              aria-label="الربع"
            >
              {QUARTERS_AR.map((qr) => <option key={qr.v} value={qr.v}>{qr.l}</option>)}
            </Select>
          )}

          {/* Custom date range */}
          {mode === 'custom' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 shrink-0">من</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setFrom(e.target.value)}
                  className={DATE_CLS}
                  aria-label="من تاريخ"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 shrink-0">إلى</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setTo(e.target.value)}
                  className={DATE_CLS}
                  aria-label="إلى تاريخ"
                />
              </div>
            </>
          )}

          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Comparison */}
          <Select
            inputSize="sm"
            value={compare}
            onChange={(e) => setCompare(e.target.value as CompareMode)}
            className="w-48"
            aria-label="وضع المقارنة"
          >
            <option value="none">بدون مقارنة</option>
            <option value="previous-period">الفترة السابقة</option>
            <option value="previous-month">الشهر السابق</option>
            <option value="yoy">نفس الفترة من العام السابق</option>
          </Select>

          {/* Apply + Clear */}
          <div className="flex items-center gap-1.5 ms-auto">
            <Button type="submit" variant="primary" size="sm">تطبيق</Button>
            {hasAdvanced && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>مسح</Button>
            )}
          </div>

          <span className="h-5 w-px bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Advanced filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors',
              showFilters ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
            {hasAdvanced && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                !
              </span>
            )}
          </button>
        </div>

        {/* ── Advanced panel — expands inside same card ─────────────────── */}
        {showFilters && (
          <div className="border-t border-hairline bg-surface-muted/30 px-4 py-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">المشروع</label>
                <Select
                  inputSize="sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-label="المشروع"
                >
                  <option value="">كل المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">العميل</label>
                <Input
                  inputSize="sm"
                  placeholder="ابحث باسم العميل"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="العميل"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">نوع الدفعة</label>
                <Select
                  inputSize="sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  aria-label="نوع الدفعة"
                >
                  <option value="">كل الأنواع</option>
                  <option value="BOOKING_AMOUNT">مبلغ الحجز</option>
                  <option value="DOWN_PAYMENT">دفعة أولى</option>
                  <option value="INSTALLMENT">قسط شهري</option>
                  <option value="FINAL_PAYMENT">دفعة أخيرة</option>
                </Select>
              </div>
            </div>
          </div>
        )}

      </form>
    </div>
  );
}
