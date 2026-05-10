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

const COUNT_PILL: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700',
  info: 'bg-info-50 text-info-700',
  purple: 'bg-purple-50 text-purple-700',
  warning: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-700',
  danger: 'bg-danger-50 text-danger-700',
};

interface Props {
  label: string;
  count: number;
  tone: Tone;
  isOver?: boolean;
  isEmpty?: boolean;
  children: ReactNode;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function StageColumn({ label, count, tone, isOver, isEmpty, children }: Props) {
  return (
    <div className="flex flex-col w-[320px] sm:w-[340px] lg:w-[360px] shrink-0">
      <div className="flex items-center justify-between gap-2 px-1 mb-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', DOT[tone])} />
          <h3 className="text-sm font-semibold text-slate-700 tracking-tight">
            {label}
          </h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[30px] h-6 px-2 rounded-lg text-xs font-bold tabular-nums',
            COUNT_PILL[tone],
          )}
        >
          {pad2(count)}
        </span>
      </div>

      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl p-3 min-h-[560px] transition-colors duration-150',
          isOver
            ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-500/40'
            : 'bg-info-50/50 ring-1 ring-inset ring-hairline/70',
        )}
      >
        {isEmpty ? (
          <div
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
              isOver
                ? 'border-brand-500/60 bg-brand-50/40 text-brand-700'
                : 'border-hairline text-slate-400',
            )}
          >
            <Inbox className="h-6 w-6" strokeWidth={1.5} />
            <p className="text-2xs font-medium">
              {isOver ? 'أفلت العميل هنا' : 'اسحب عميل إلى هذه المرحلة'}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
