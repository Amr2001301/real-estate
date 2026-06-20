'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LeadStage } from '@/lib/types';

const STAGE_CONFIG: Array<{ key: LeadStage; label: string; dot: string; count: string }> = [
  { key: 'NEW',         label: 'جدد',    dot: 'bg-slate-400',   count: 'bg-slate-100 text-slate-600'     },
  { key: 'INTERESTED',  label: 'مهتمون', dot: 'bg-sky-400',     count: 'bg-sky-50 text-sky-700'          },
  { key: 'VISIT',       label: 'زيارة',  dot: 'bg-violet-400',  count: 'bg-violet-50 text-violet-700'    },
  { key: 'NEGOTIATION', label: 'تفاوض',  dot: 'bg-amber-400',   count: 'bg-amber-50 text-amber-700'      },
  { key: 'WON',         label: 'فوز',    dot: 'bg-emerald-400', count: 'bg-emerald-50 text-emerald-700'  },
  { key: 'LOST',        label: 'خسارة',  dot: 'bg-rose-400',    count: 'bg-rose-50 text-rose-700'        },
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
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [spinning, setSpinning] = useState(false);
  const [, setTick] = useState(0);

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
      'bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden',
      className,
    )}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 sm:px-6 py-4">

        {/* Totals — hero metrics on the right (RTL-first) */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">إجمالي</p>
            <p className="text-[22px] font-black text-navy tabular-nums leading-none">
              {totalLeads.toLocaleString('ar-EG')}
            </p>
          </div>
          <div className="h-10 w-px bg-hairline shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">تحويل</p>
            <p className="text-[22px] font-black text-brand-600 tabular-nums leading-none">{conversion}%</p>
          </div>
        </div>

        <div className="hidden sm:block h-7 w-px bg-hairline shrink-0" />

        {/* Stage counts */}
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap flex-1">
          {STAGE_CONFIG.map((s) => {
            const n = counts[s.key] ?? 0;
            return (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                <span className="text-[12px] text-slate-500">{s.label}</span>
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10.5px] font-bold tabular-nums',
                  n > 0 ? s.count : 'bg-slate-100 text-slate-400',
                )}>
                  {n}
                </span>
              </span>
            );
          })}
        </div>

        <div className="hidden sm:block h-7 w-px bg-hairline shrink-0" />

        {/* Refresh + timestamp */}
        <div className="flex items-center gap-2.5 shrink-0 ms-auto sm:ms-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={spinning}
            aria-label="تحديث البيانات"
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-xl',
              'bg-slate-50 text-slate-400 ring-1 ring-slate-200/80',
              'hover:bg-brand-50 hover:text-brand-600 hover:ring-brand-100 transition-colors',
              'focus-visible:outline-none disabled:opacity-50',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 transition-transform', spinning && 'animate-spin')} />
          </button>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-400 leading-none">آخر تحديث</p>
            <p className="text-[12px] font-semibold text-slate-600 leading-none">
              {relativeTime(loadedAt)}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
