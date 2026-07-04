// Shared pure helpers — no server/client marker, safe to import from both.

export const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label,
}));

export const YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1].map(String);
})();

export function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  return `${MONTH_NAMES[Number(month) - 1] ?? ''} ${year}`;
}

// RTL-safe: "700,000 ر.س" — Latin digits + Arabic suffix
export function fmtAmt(value: number | string | null | undefined, symbol = 'ج.م'): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  if (n === 0) return `0 ${symbol}`;
  return `${n.toLocaleString('en-US')} ${symbol}`;
}

export function num(n: number): string {
  return String(n);
}

export function pctLabel(value: number | null): string {
  if (value === null) return '—';
  if (value > 999) return '+999%';
  return `${value}%`;
}

export function pctBarColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 75) return 'bg-brand-500';
  if (pct >= 50) return 'bg-amber-400';
  if (pct > 0) return 'bg-red-400';
  return 'bg-slate-200';
}

export function pctTextColor(pct: number | null): string {
  if (pct === null || pct === 0) return 'text-slate-400';
  if (pct >= 100) return 'text-emerald-700 font-semibold';
  if (pct >= 75) return 'text-brand-700';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-600';
}
