'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LeadStage } from '@/lib/types';

const STAGE_CONFIG: Array<{ key: LeadStage; label: string; dot: string }> = [
  { key: 'NEW',         label: 'جدد',    dot: 'bg-slate-400'   },
  { key: 'INTERESTED',  label: 'مهتمون', dot: 'bg-sky-400'     },
  { key: 'VISIT',       label: 'زيارة',  dot: 'bg-violet-400'  },
  { key: 'NEGOTIATION', label: 'تفاوض',  dot: 'bg-amber-400'   },
  { key: 'WON',         label: 'فوز',    dot: 'bg-emerald-400' },
  { key: 'LOST',        label: 'خسارة',  dot: 'bg-rose-400'    },
];

interface Props {
  totalLeads: number;
  wonCount: number;
  counts: Partial<Record<LeadStage, number>>;
  className?: string;
}

function relativeTime(date: Date): string {
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diff < 60) return 'الآن';
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.floor(hours / 24)} يوم`;
}

export function PipelineStatsBar({ totalLeads, wonCount, counts, className }: Props) {
  const router = useRouter();
  // loadedAt resets on every manual refresh so the displayed time stays accurate
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [spinning, setSpinning] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every 30 s so relative time stays live
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const handleRefresh = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setLoadedAt(new Date());
    router.refresh();
    setTimeout(() => setSpinning(false), 800);
  }, [router, spinning]);

  const conversion = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-x-4 gap-y-2',
      'rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs',
      className,
    )}>

      {/* Refresh + timestamp */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={spinning}
          aria-label="تحديث البيانات"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-lg',
            'text-slate-400 ring-1 ring-inset ring-slate-200',
            'hover:text-slate-700 hover:bg-slate-50 transition-colors',
            'focus-visible:outline-none disabled:opacity-50',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5 transition-transform', spinning && 'animate-spin')} />
        </button>
        <span className="text-xs text-slate-400">
          آخر تحديث:{' '}
          <span className="font-semibold text-slate-600">{relativeTime(loadedAt)}</span>
        </span>
      </div>

      <span aria-hidden className="hidden sm:block w-px h-4 bg-slate-200/80" />

      {/* Stage counts — colored dots match the column headers */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap flex-1">
        {STAGE_CONFIG.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', s.dot)} />
            <span className="text-slate-500">{s.label}</span>
            <span className="font-bold text-slate-700 tabular-nums">{counts[s.key] ?? 0}</span>
          </span>
        ))}
      </div>

      <span aria-hidden className="hidden sm:block w-px h-4 bg-slate-200/80" />

      {/* Summary totals */}
      <div className="flex items-center gap-4 shrink-0 text-xs">
        <span className="text-slate-500">
          إجمالي{' '}
          <span className="font-black text-slate-800 tabular-nums">
            {totalLeads.toLocaleString('ar-EG')}
          </span>
        </span>
        <span className="text-slate-500">
          تحويل{' '}
          <span className="font-black text-slate-800 tabular-nums">{conversion}%</span>
        </span>
      </div>

    </div>
  );
}
