'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LeadStage } from '@/lib/types';

const STAGE_CONFIG: Array<{
  key: LeadStage;
  label: string;
  dot: string;
  chip: string;
}> = [
  { key: 'NEW',         label: 'جدد',    dot: 'bg-slate-400',   chip: 'bg-slate-100   text-slate-700  border-slate-200'   },
  { key: 'INTERESTED',  label: 'مهتمون', dot: 'bg-sky-400',     chip: 'bg-sky-50      text-sky-700    border-sky-100'     },
  { key: 'VISIT',       label: 'زيارة',  dot: 'bg-violet-400',  chip: 'bg-violet-50   text-violet-700 border-violet-100'  },
  { key: 'NEGOTIATION', label: 'تفاوض',  dot: 'bg-amber-400',   chip: 'bg-amber-50    text-amber-700  border-amber-100'   },
  { key: 'WON',         label: 'فوز',    dot: 'bg-emerald-400', chip: 'bg-emerald-50  text-emerald-700 border-emerald-100'},
  { key: 'LOST',        label: 'خسارة',  dot: 'bg-rose-400',    chip: 'bg-rose-50     text-rose-600   border-rose-100'    },
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
    <div className={cn(
      'overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-soft',
      className,
    )}>
      <div className="flex items-center gap-4 px-5 py-3">

        {/* ── Hero KPIs ─────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Total */}
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shrink-0">
              <Users className="h-4 w-4" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-black tabular-nums leading-none text-slate-900">
                {totalLeads.toLocaleString('ar-EG')}
              </span>
              <span className="text-[11px] text-slate-400">إجمالي</span>
            </div>
          </div>

          {/* Divider */}
          <span className="h-8 w-px shrink-0 bg-hairline" />

          {/* Conversion */}
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-black tabular-nums leading-none text-brand-600">
                {conversion}%
              </span>
              <span className="text-[11px] text-slate-400">تحويل</span>
            </div>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────── */}
        <span className="h-8 w-px shrink-0 bg-hairline" />

        {/* ── Stage chips ───────────────────────────────────────── */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap">
          {STAGE_CONFIG.map((s) => {
            const n = counts[s.key] ?? 0;
            return (
              <div
                key={s.key}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-opacity',
                  n === 0 ? 'opacity-40' : '',
                  s.chip,
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
                <span className="text-[11px] font-medium">{s.label}</span>
                <span className="text-[13px] font-black tabular-nums leading-none">
                  {n}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Refresh ───────────────────────────────────────────── */}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-slate-400 tabular-nums">{relativeTime(loadedAt)}</span>
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
