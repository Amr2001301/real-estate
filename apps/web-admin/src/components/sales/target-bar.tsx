import { cn } from '@/lib/cn';
import { STATUS_BAR, type TargetStatus } from '@/lib/target-pace';

/**
 * A target's progress bar with a thin marker where an even pace would be by
 * today, so "40%" reads as ahead or behind at a glance.
 */
export function TargetBar({
  label,
  pct,
  expected,
  status,
  figure,
  className,
}: {
  label: string;
  pct: number | null;
  /** Hidden when null (the month has not started, or there is no target). */
  expected: number | null;
  status: TargetStatus;
  /** e.g. "700,000 / 1,000,000 ج.م" or "3 / 4". */
  figure: React.ReactNode;
  className?: string;
}) {
  const w = Math.min(Math.max(pct ?? 0, 0), 100);
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold text-slate-500">{label}</span>
        <span className="truncate text-slate-600 tabular-nums">{figure}</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-surface-muted">
        <span className={cn('absolute inset-y-0 start-0 rounded-full', STATUS_BAR[status])} style={{ width: `${w}%` }} />
        {expected !== null && expected > 0 && expected < 100 && (
          <span
            aria-hidden
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-900/70"
            style={{ insetInlineStart: `calc(${expected}% - 1px)` }}
          />
        )}
      </div>
    </div>
  );
}
