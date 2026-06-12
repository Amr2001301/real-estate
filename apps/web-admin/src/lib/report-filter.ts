// Report period filter helpers — pure functions, no React dependency.
// Used by both the server page (resolving API params) and tests.

export type PeriodMode = 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type CompareMode = 'none' | 'previous-period' | 'previous-month' | 'yoy';

export interface ReportFilterParams {
  mode?: string;
  month?: string;
  year?: string;
  quarter?: string;
  dateFrom?: string;
  dateTo?: string;
  compare?: string;
  projectId?: string;
  // Legacy
  period?: string;
}

export interface ResolvedDateRange {
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
  quarter: number;
  mode: PeriodMode;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Last calendar day of a month as YYYY-MM-DD, UTC-safe.
// month is 1-indexed. Passing day=0 to Date gives the last day of the prior month.
function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

// Quarter → first/last month mapping
const Q_START = [0, 1, 4, 7, 10] as const; // index 1-4
const Q_END   = [0, 3, 6, 9, 12] as const;

export function resolveReportDateRange(params: ReportFilterParams): ResolvedDateRange {
  const now = new Date();
  const currentYear  = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  // Map legacy period=YYYY-MM → monthly mode (backward-compat for old links).
  if (params.period && !params.mode) {
    const [py, pm] = params.period.split('-').map(Number);
    if (py && pm && pm >= 1 && pm <= 12) {
      return {
        dateFrom: `${py}-${pad(pm)}-01`,
        dateTo: lastDayOfMonth(py, pm),
        year: py,
        month: pm,
        quarter: Math.ceil(pm / 3),
        mode: 'monthly',
      };
    }
  }

  const year  = parseInt(params.year  ?? '', 10) || currentYear;
  const mode  = (params.mode as PeriodMode) ?? 'monthly';

  if (mode === 'quarterly') {
    const q = Math.min(4, Math.max(1, parseInt(params.quarter ?? '', 10) || 1));
    return {
      dateFrom: `${year}-${pad(Q_START[q]!)}-01`,
      dateTo:   lastDayOfMonth(year, Q_END[q]!),
      year,
      month:   Q_START[q]!,
      quarter: q,
      mode:    'quarterly',
    };
  }

  if (mode === 'yearly') {
    return {
      dateFrom: `${year}-01-01`,
      dateTo:   `${year}-12-31`,
      year,
      month:   1,
      quarter: 1,
      mode:    'yearly',
    };
  }

  if (mode === 'custom') {
    const from = params.dateFrom ?? `${year}-01-01`;
    const to   = params.dateTo   ?? `${year}-12-31`;
    // Derive year from dateFrom for trend chart
    const customYear = parseInt(from.slice(0, 4), 10) || year;
    return {
      dateFrom: from,
      dateTo:   to,
      year:    customYear,
      month:   parseInt(from.slice(5, 7), 10) || 1,
      quarter: 1,
      mode:    'custom',
    };
  }

  // Default: monthly
  const month = Math.min(12, Math.max(1, parseInt(params.month ?? '', 10) || currentMonth));
  return {
    dateFrom: `${year}-${pad(month)}-01`,
    dateTo:   lastDayOfMonth(year, month),
    year,
    month,
    quarter: Math.ceil(month / 3),
    mode:    'monthly',
  };
}

export function resolveComparisonDateRange(
  current: ResolvedDateRange,
  compare: string,
): { dateFrom: string; dateTo: string } | null {
  if (!compare || compare === 'none') return null;

  const from = new Date(current.dateFrom + 'T00:00:00Z');
  const to   = new Date(current.dateTo   + 'T00:00:00Z');
  const durationDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  if (compare === 'previous-period') {
    const newToMs   = from.getTime() - 86_400_000;
    const newFromMs = newToMs - (durationDays - 1) * 86_400_000;
    return {
      dateFrom: new Date(newFromMs).toISOString().slice(0, 10),
      dateTo:   new Date(newToMs).toISOString().slice(0, 10),
    };
  }

  if (compare === 'previous-month') {
    const prevEnd   = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 0));
    const prevStart = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
    return {
      dateFrom: prevStart.toISOString().slice(0, 10),
      dateTo:   prevEnd.toISOString().slice(0, 10),
    };
  }

  if (compare === 'yoy') {
    const y1 = from.getUTCFullYear() - 1;
    const y2 = to.getUTCFullYear()   - 1;
    return {
      dateFrom: `${y1}-${pad(from.getUTCMonth() + 1)}-${pad(from.getUTCDate())}`,
      dateTo:   `${y2}-${pad(to.getUTCMonth()   + 1)}-${pad(to.getUTCDate())}`,
    };
  }

  return null;
}

export function computeDelta(
  current: number,
  previous: number,
): { value: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0 || !Number.isFinite(previous))
    return { value: '—', direction: 'flat' };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.05) return { value: '0%', direction: 'flat' };
  return {
    value: `${Math.abs(pct).toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down',
  };
}
