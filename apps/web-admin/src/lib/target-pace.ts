// Where a monthly sales target stands: before its month, during it (against
// the share of the month already gone), or after it. Pure, so the server
// pages and the client table read the same answer.

export type TargetPhase = 'upcoming' | 'current' | 'ended';
export type TargetStatus = 'none' | 'upcoming' | 'achieved' | 'onTrack' | 'behind' | 'missed';

/** `period` is "YYYY-MM"; `today` is the company's "YYYY-MM-DD". */
export function targetPhase(period: string, today: string): TargetPhase {
  const month = today.slice(0, 7);
  if (period > month) return 'upcoming';
  if (period < month) return 'ended';
  return 'current';
}

/** The share of the target that should be done by `today` if work kept an even pace. */
export function expectedPct(period: string, today: string): number {
  const phase = targetPhase(period, today);
  if (phase === 'upcoming') return 0;
  if (phase === 'ended') return 100;
  const [y, m] = period.split('-').map(Number);
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Math.round((Number(today.slice(8, 10)) / days) * 100);
}

/** One achievement figure: the value and the units each count half. */
export function attainment(amountPct: number | null, unitsPct: number | null): number | null {
  const parts = [amountPct, unitsPct].filter((p): p is number => p !== null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function targetStatus(att: number | null, period: string, today: string): TargetStatus {
  const phase = targetPhase(period, today);
  if (phase === 'upcoming') return 'upcoming';
  if (att === null) return 'none';
  if (att >= 100) return 'achieved';
  if (phase === 'ended') return 'missed';
  return att >= expectedPct(period, today) ? 'onTrack' : 'behind';
}

export const STATUS_CHIP: Record<TargetStatus, string> = {
  none: 'bg-slate-500/10 text-slate-500',
  upcoming: 'bg-sky-500/12 text-sky-600',
  achieved: 'bg-emerald-500/12 text-emerald-600',
  onTrack: 'bg-brand-500/12 text-brand-700',
  behind: 'bg-amber-500/12 text-amber-600',
  missed: 'bg-danger-500/12 text-danger-600',
};

export const STATUS_BAR: Record<TargetStatus, string> = {
  none: 'bg-slate-400',
  upcoming: 'bg-sky-500',
  achieved: 'bg-emerald-500',
  onTrack: 'bg-brand-500',
  behind: 'bg-amber-500',
  missed: 'bg-danger-500',
};
