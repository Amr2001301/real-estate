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
  if (minutes < 60) return `قبل ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} س`;
  return `قبل ${Math.floor(hours / 24)} ي`;
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
    <div className={cn('overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs', className)}>
      <div className="flex items-center gap-5 px-5 py-3">

        {/* Hero metrics */}
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-[20px] font-black tabular-nums leading-none text-slate-900">
            {totalLeads.toLocaleString('ar-EG')}
          </span>
          <span className="text-[11px] text-slate-400">إجمالي</span>
        </div>

        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-[18px] font-black tabular-nums leading-none text-brand-600">
            {conversion}%
          </span>
          <span className="text-[11px] text-slate-400">تحويل</span>
        </div>

        <div className="h-5 w-px shrink-0 bg-hairline" />

        {/* Stage items */}
        <div className="flex flex-1 items-center gap-5 overflow-x-auto">
          {STAGE_CONFIG.map((s) => {
            const n = counts[s.key] ?? 0;
            return (
              <div key={s.key} className="flex shrink-0 items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
                <span className="text-[12px] text-slate-500">{s.label}</span>
                <span className={cn(
                  'text-[13px] font-bold tabular-nums leading-none',
                  n === 0 ? 'text-slate-300' : 'text-slate-800',
                )}>
                  {n}
                </span>
              </div>
            );
          })}
        </div>

        {/* Refresh */}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-slate-400">{relativeTime(loadedAt)}</span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={spinning}
            aria-label="تحديث البيانات"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus-visible:outline-none disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', spinning && 'animate-spin')} />
          </button>
        </div>

      </div>
    </div>
  );
}
