'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  totalLeads: number;
  wonCount: number;
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

export function PipelineStatsBar({ totalLeads, wonCount, className }: Props) {
  const router = useRouter();
  const [loadedAt] = useState(() => new Date());
  const [, setTick] = useState(0);

  // Re-render every minute so the relative time stays fresh.
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const conversion =
    totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div
      className={cn(
        'rounded-2xl border border-hairline bg-white shadow-soft px-5 py-3.5',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.refresh()}
            aria-label="تحديث البيانات"
            title="تحديث البيانات"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl',
              'bg-surface text-slate-600 ring-1 ring-inset ring-hairline shadow-xs',
              'hover:text-brand-600 hover:bg-brand-50 hover:ring-brand-200',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            )}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-500">
            آخر تحديث: <span className="font-semibold text-slate-700">{relativeTime(loadedAt)}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="إجمالي العملاء"
            value={totalLeads.toLocaleString('ar-EG')}
            tone="brand"
          />
          <span aria-hidden className="hidden sm:inline-block w-px h-6 bg-hairline" />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="معدل التحويل"
            value={`${conversion}%`}
            tone="success"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'brand' | 'success';
}) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg',
          tone === 'brand'
            ? 'bg-brand-50 text-brand-600'
            : 'bg-success-50 text-success-600',
        )}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <p className="text-2xs text-slate-500">{label}</p>
        <p
          className={cn(
            'text-base font-bold tabular-nums tracking-tight',
            tone === 'brand' ? 'text-slate-900' : 'text-success-700',
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
