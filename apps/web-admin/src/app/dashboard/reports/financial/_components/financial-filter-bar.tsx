'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { CompareMode, PeriodMode } from '@/lib/report-filter';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

function buildYears(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => y + 1 - i);
}
const YEARS = buildYears();

const DATE_CLS =
  'h-8 rounded-lg border border-hairline bg-white px-2.5 text-xs text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors';

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
  locale?: Locale;
}

export function FinancialFilterBar({
  defaultMode, defaultMonth, defaultYear, defaultQuarter,
  defaultDateFrom, defaultDateTo, defaultCompare,
  defaultProjectId = '', defaultQ = '', defaultType = '',
  defaultShowFilters = false,
  projects,
  locale = 'ar',
}: FinancialFilterBarProps) {
  const router = useRouter();
  const fb = uiT(locale).financialFilterBar;

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
            aria-label={fb.periodLabel}
          >
            {(Object.keys(fb.periodModes) as PeriodMode[]).map((pm) => (
              <option key={pm} value={pm}>{fb.periodModes[pm]}</option>
            ))}
          </Select>

          {/* Year (not shown in custom mode) */}
          {mode !== 'custom' && (
            <Select
              inputSize="sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24"
              aria-label={fb.yearLabel}
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
              aria-label={fb.monthLabel}
            >
              {fb.months.map((mo) => <option key={mo.v} value={mo.v}>{mo.l}</option>)}
            </Select>
          )}

          {/* Quarter (quarterly mode) */}
          {mode === 'quarterly' && (
            <Select
              inputSize="sm"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className="w-56"
              aria-label={fb.quarterLabel}
            >
              {fb.quarters.map((qr) => <option key={qr.v} value={qr.v}>{qr.l}</option>)}
            </Select>
          )}

          {/* Custom date range */}
          {mode === 'custom' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 shrink-0">{fb.fromLabel}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setFrom(e.target.value)}
                  className={DATE_CLS}
                  aria-label={fb.fromAriaLabel}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 shrink-0">{fb.toLabel}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setTo(e.target.value)}
                  className={DATE_CLS}
                  aria-label={fb.toAriaLabel}
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
            aria-label={fb.compareLabel}
          >
            <option value="none">{fb.compareOptions.none}</option>
            <option value="previous-period">{fb.compareOptions.prevPeriod}</option>
            <option value="previous-month">{fb.compareOptions.prevMonth}</option>
            <option value="yoy">{fb.compareOptions.yoy}</option>
          </Select>

          {/* Apply + Clear */}
          <div className="flex items-center gap-1.5 ms-auto">
            <Button type="submit" variant="primary" size="sm">{fb.applyBtn}</Button>
            {hasAdvanced && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>{fb.clearBtn}</Button>
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
            {showFilters ? fb.hideFilters : fb.showFilters}
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
                <label className="text-[11px] font-medium text-slate-400">{fb.advancedPanel.projectLabel}</label>
                <Select
                  inputSize="sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-label={fb.advancedPanel.projectLabel}
                >
                  <option value="">{fb.advancedPanel.allProjects}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">{fb.advancedPanel.clientLabel}</label>
                <Input
                  inputSize="sm"
                  placeholder={fb.advancedPanel.clientPlaceholder}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label={fb.advancedPanel.clientLabel}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">{fb.advancedPanel.typeLabel}</label>
                <Select
                  inputSize="sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  aria-label={fb.advancedPanel.typeLabel}
                >
                  <option value="">{fb.advancedPanel.allTypes}</option>
                  {(Object.keys(fb.advancedPanel.typeOptions) as Array<keyof typeof fb.advancedPanel.typeOptions>).map((k) => (
                    <option key={k} value={k}>{fb.advancedPanel.typeOptions[k]}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        )}

      </form>
    </div>
  );
}
