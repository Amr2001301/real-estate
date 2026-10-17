'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PremiumFilterField } from '@/components/premium/filter-bar';
import type { CompareMode, PeriodMode } from '@/lib/report-filter';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

function buildYears(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => y + 1 - i);
}
const YEARS = buildYears();

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

  // U5: apply on change, no Apply button. Typing in the client box waits a beat.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (mode === 'custom' && (!dateFrom || !dateTo)) return;
    const t = setTimeout(() => router.push(`/dashboard/reports/financial?${buildParams().toString()}`), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, month, year, quarter, dateFrom, dateTo, compare, projectId, q, type]);

  function handleClear() {
    setProjectId('');
    setQ('');
    setType('');
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[0_10px_30px_-18px_rgb(20_26_38/0.25)]">
      <form onSubmit={(e) => e.preventDefault()}>

        {/* ── Main filter row ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5 p-2 sm:p-2.5">
          <div role="radiogroup" aria-label={fb.periodLabel} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken/60 p-1">
            {(Object.keys(fb.periodModes) as PeriodMode[]).map((pm) => (
              <button
                key={pm}
                type="button"
                role="radio"
                aria-checked={mode === pm}
                onClick={() => setMode(pm)}
                className={
                  mode === pm
                    ? 'h-10 rounded-full bg-surface px-5 text-[14px] font-bold text-slate-900 shadow-sm'
                    : 'h-10 rounded-full px-5 text-[14px] text-slate-600 hover:text-slate-900'
                }
              >
                {fb.periodModes[pm]}
              </button>
            ))}
          </div>

          {mode !== 'custom' && (
            <PremiumFilterField neutral label={fb.yearLabel} htmlFor="ff-year">
              <Select id="ff-year" inputSize="sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </PremiumFilterField>
          )}
          {mode === 'monthly' && (
            <PremiumFilterField neutral label={fb.monthLabel} htmlFor="ff-month">
              <Select id="ff-month" inputSize="sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {fb.months.map((mo) => <option key={mo.v} value={mo.v}>{mo.l}</option>)}
              </Select>
            </PremiumFilterField>
          )}
          {mode === 'quarterly' && (
            <PremiumFilterField neutral label={fb.quarterLabel} htmlFor="ff-quarter">
              <Select id="ff-quarter" inputSize="sm" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                {fb.quarters.map((qr) => <option key={qr.v} value={qr.v}>{qr.l}</option>)}
              </Select>
            </PremiumFilterField>
          )}
          {mode === 'custom' && (
            <>
              <PremiumFilterField neutral label={fb.fromLabel} htmlFor="ff-from">
                <input id="ff-from" type="date" value={dateFrom} onChange={(e) => setFrom(e.target.value)} aria-label={fb.fromAriaLabel} />
              </PremiumFilterField>
              <PremiumFilterField neutral label={fb.toLabel} htmlFor="ff-to">
                <input id="ff-to" type="date" value={dateTo} onChange={(e) => setTo(e.target.value)} aria-label={fb.toAriaLabel} />
              </PremiumFilterField>
            </>
          )}
          <PremiumFilterField neutral label={fb.compareLabel} htmlFor="ff-compare">
            <Select id="ff-compare" inputSize="sm" value={compare} onChange={(e) => setCompare(e.target.value as CompareMode)}>
              <option value="none">{fb.compareOptions.none}</option>
              <option value="previous-period">{fb.compareOptions.prevPeriod}</option>
              <option value="previous-month">{fb.compareOptions.prevMonth}</option>
              <option value="yoy">{fb.compareOptions.yoy}</option>
            </Select>
          </PremiumFilterField>

          <div className="ms-auto flex items-center gap-2">
            {hasAdvanced && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>{fb.clearBtn}</Button>
            )}
            {/* More filters */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full border border-dashed px-4 text-[13.5px] font-bold transition-colors',
                showFilters || hasAdvanced ? 'border-brand-400/70 text-brand-700' : 'border-hairline text-slate-700 hover:border-brand-400/50',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {showFilters ? fb.hideFilters : fb.showFilters}
            </button>
          </div>
        </div>

        {/* ── Advanced panel — expands inside same card ─────────────────── */}
        {showFilters && (
          <div className="border-t border-hairline px-5 py-4">
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
