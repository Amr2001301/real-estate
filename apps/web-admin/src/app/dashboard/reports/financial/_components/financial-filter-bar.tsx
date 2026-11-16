'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PremiumFilterBar, PremiumFilterField, PremiumFilterAdvancedPanel, PremiumFilterAdvancedToggle } from '@/components/premium/filter-bar';
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
  /** 'report' keeps the plain report on screen while a comparison is chosen. */
  defaultView?: string;
  projects: { id: string; name: string }[];
  locale?: Locale;
}

/** A field that fills its grid column, its value at the far end. */

export function FinancialFilterBar({
  defaultMode, defaultMonth, defaultYear, defaultQuarter,
  defaultDateFrom, defaultDateTo, defaultCompare,
  defaultProjectId = '', defaultQ = '', defaultType = '',
  defaultShowFilters = false,
  defaultView = '',
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
    if (compare !== 'none' && defaultView === 'report') p.set('view', 'report');
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
    <PremiumFilterBar
      autoSubmit={false}
      onSubmit={(e) => e.preventDefault()}
      trailing={
        <>
          {hasAdvanced && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>{fb.clearBtn}</Button>
          )}
          <PremiumFilterAdvancedToggle
            onClick={() => setShowFilters(!showFilters)}
            open={showFilters}
            active={hasAdvanced}
            label={showFilters ? fb.hideFilters : fb.showFilters}
          />
        </>
      }
    >
      <PremiumFilterField neutral label={fb.periodLabel} htmlFor="ff-mode">
        <Select id="ff-mode" inputSize="sm" value={mode} onChange={(e) => setMode(e.target.value as PeriodMode)}>
          {(Object.keys(fb.periodModes) as PeriodMode[]).map((pm) => (
            <option key={pm} value={pm}>{fb.periodModes[pm]}</option>
          ))}
        </Select>
      </PremiumFilterField>
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

      {showFilters && (
        <PremiumFilterAdvancedPanel>
          <PremiumFilterField label={fb.advancedPanel.projectLabel} htmlFor="ff-project">
            <Select id="ff-project" inputSize="sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{fb.advancedPanel.allProjects}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </PremiumFilterField>
          <PremiumFilterField label={fb.advancedPanel.clientLabel} htmlFor="ff-client">
            <Input id="ff-client" placeholder={fb.advancedPanel.clientPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          </PremiumFilterField>
          <PremiumFilterField label={fb.advancedPanel.typeLabel} htmlFor="ff-type">
            <Select id="ff-type" inputSize="sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{fb.advancedPanel.allTypes}</option>
              {(Object.keys(fb.advancedPanel.typeOptions) as Array<keyof typeof fb.advancedPanel.typeOptions>).map((k) => (
                <option key={k} value={k}>{fb.advancedPanel.typeOptions[k]}</option>
              ))}
            </Select>
          </PremiumFilterField>
        </PremiumFilterAdvancedPanel>
      )}
    </PremiumFilterBar>
  );
}
