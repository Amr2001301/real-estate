import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'gray' | 'info' | 'purple' | 'warning' | 'success' | 'danger';

// U5: the stage colour is only a 3px line on top of the column.
const LINE: Record<Tone, string> = {
  gray:    'bg-slate-400',
  info:    'bg-[#C79A3B]/70',
  purple:  'bg-[#C79A3B]',
  warning: 'bg-[#A87E2C]',
  success: 'bg-unit-available',
  danger:  'bg-danger-600/70',
};

interface Props {
  label: string;
  count: number;
  tone: Tone;
  isOver?: boolean;
  isEmpty?: boolean;
  /** Shown in the dashed lane of an empty column. */
  emptyLabel?: string;
  children: ReactNode;
}

/** A kanban column (U5): fixed 288px, Naskh title, count in Cormorant, dashed "drop here" when empty. */
export function StageColumn({ label, count, tone, isOver, isEmpty, emptyLabel = 'اسحب فرصة إلى هنا', children }: Props) {
  return (
    <div className="flex w-[288px] shrink-0 flex-col">
      <div
        className={cn(
          'relative flex min-h-[460px] flex-col overflow-hidden rounded-[22px] border bg-surface transition-all duration-150',
          isOver ? 'border-brand-400/60 shadow-[0_0_0_3px_rgb(200_162_75/0.15)]' : 'border-hairline',
        )}
      >
        <span aria-hidden className={cn('absolute inset-x-0 top-0 h-[3px]', LINE[tone])} />
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
          <h3 className="font-heading text-[16px] font-bold text-slate-900">{label}</h3>
          <span className="num text-[28px] font-semibold leading-none text-slate-700">{count}</span>
        </div>

        <div className={cn('flex flex-1 flex-col gap-3 px-3 pb-3', isOver && 'bg-brand-50/30')}>
          {isEmpty ? (
            <div
              className={cn(
                'flex flex-1 items-center justify-center rounded-[16px] border border-dashed px-4 text-center text-[13px] transition-colors',
                isOver ? 'border-brand-400/70 text-brand-700' : 'border-hairline text-slate-500',
              )}
            >
              {emptyLabel}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
