import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'gray' | 'info' | 'purple' | 'warning' | 'success' | 'danger';

const DOT: Record<Tone, string> = {
  gray: 'bg-slate-400',
  info: 'bg-info-500',
  purple: 'bg-purple-500',
  warning: 'bg-brand-500',
  success: 'bg-success-500',
  danger: 'bg-danger-500',
};

const HEADER_BG: Record<Tone, string> = {
  gray: 'bg-slate-50 border-slate-200/70',
  info: 'bg-info-50/70 border-info-100',
  purple: 'bg-purple-50/70 border-purple-100',
  warning: 'bg-amber-50/80 border-brand-100',
  success: 'bg-success-50/60 border-success-100',
  danger: 'bg-danger-50/50 border-danger-100',
};

const COUNT_PILL: Record<Tone, string> = {
  gray: 'bg-slate-200/80 text-slate-600',
  info: 'bg-info-100/80 text-info-700',
  purple: 'bg-purple-100/80 text-purple-700',
  warning: 'bg-brand-100/80 text-brand-700',
  success: 'bg-success-100/80 text-success-700',
  danger: 'bg-danger-100/80 text-danger-700',
};

interface Props {
  label: string;
  count: number;
  tone: Tone;
  isOver?: boolean;
  isEmpty?: boolean;
  children: ReactNode;
}

export function StageColumn({ label, count, tone, isOver, isEmpty, children }: Props) {
  return (
    <div className="flex flex-col w-[300px] sm:w-[316px] shrink-0">
      {/* Column header — styled tone-matched lane label */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 mb-3',
          HEADER_BG[tone],
        )}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn('h-2 w-2 rounded-full shrink-0', DOT[tone])} />
          <h3 className="text-xs font-bold text-slate-700">{label}</h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[11px] font-bold tabular-nums',
            COUNT_PILL[tone],
          )}
        >
          {count}
        </span>
      </div>

      {/* Cards area */}
      <div
        className={cn(
          'flex flex-col gap-2.5 rounded-2xl p-2.5 min-h-[200px] transition-colors duration-150',
          'ring-1 ring-inset ring-hairline/50',
          isOver
            ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-400/40'
            : 'bg-slate-50/60',
        )}
      >
        {isEmpty ? (
          <div
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-colors',
              isOver
                ? 'border-brand-400/50 bg-brand-50/30 text-brand-500'
                : 'border-slate-200 text-slate-400',
            )}
          >
            <Inbox className="h-5 w-5 opacity-50" strokeWidth={1.5} />
            <p className="text-[11px] font-medium text-center px-4 leading-relaxed">
              {isOver ? 'أفلت العميل هنا' : 'لا توجد فرص\nفي هذه المرحلة'}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
