'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LeadStage } from '@/lib/types';

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW:         'جدد',
  INTERESTED:  'مهتمون',
  VISIT:       'زيارة',
  NEGOTIATION: 'تفاوض',
  WON:         'فوز',
  LOST:        'خسارة',
};

const STAGE_ORDER: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

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
  const [loadedAt] = useState(() => new Date());
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const conversion = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200/80 bg-white px-5 py-3 shadow-xs',
      className,
    )}>

      {/* Refresh + time */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => router.refresh()}
          aria-label="تحديث البيانات"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 ring-1 ring-inset ring-slate-200 hover:text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-slate-400">
          آخر تحديث: <span className="font-semibold text-slate-600">{relativeTime(loadedAt)}</span>
        </span>
      </div>

      <span aria-hidden className="hidden sm:block w-px h-4 bg-slate-200" />

      {/* Stage counts — all neutral, separator-delimited */}
      <div className="flex items-center gap-0 text-xs text-slate-500 flex-wrap">
        {STAGE_ORDER.map((key, i) => (
          <span key={key} className="flex items-center">
            {i > 0 && <span className="mx-2 text-slate-200 select-none">·</span>}
            <span className="text-slate-400">{STAGE_LABELS[key]}</span>
            <span className="font-bold text-slate-700 tabular-nums ms-1">{counts[key] ?? 0}</span>
          </span>
        ))}
      </div>

      <span aria-hidden className="hidden sm:block w-px h-4 bg-slate-200" />

      {/* Totals */}
      <div className="flex items-center gap-4 ms-auto shrink-0 text-xs">
        <span className="text-slate-500">
          إجمالي:{' '}
          <span className="font-black text-slate-800 tabular-nums">
            {totalLeads.toLocaleString('ar-EG')}
          </span>
        </span>
        <span className="text-slate-500">
          تحويل:{' '}
          <span className="font-black text-slate-800 tabular-nums">{conversion}%</span>
        </span>
      </div>

    </div>
  );
}
