import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'gray' | 'info' | 'purple' | 'warning' | 'success' | 'danger';

const DOT: Record<Tone, string> = {
  gray:    'bg-slate-400',
  info:    'bg-sky-400',
  purple:  'bg-violet-400',
  warning: 'bg-amber-400',
  success: 'bg-emerald-400',
  danger:  'bg-rose-400',
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

      {/* Premium column card */}
      <div className={cn(
        'flex flex-col rounded-[20px] border overflow-hidden min-h-[400px] transition-all duration-150',
        isOver
          ? 'border-brand-200/80 shadow-[0_4px_24px_-4px_rgb(200_162_75/0.18),0_0_0_1px_rgb(200_162_75/0.15)]'
          : 'border-hairline shadow-soft bg-surface',
      )}>
        {/* Column header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 bg-canvas/40 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', DOT[tone])} />
            <h3 className="text-[13px] font-bold text-navy leading-none">{label}</h3>
          </div>
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10.5px] font-bold tabular-nums bg-slate-100 text-slate-600">
            {count}
          </span>
        </div>

        {/* Card lane */}
        <div className={cn(
          'flex flex-col gap-2.5 p-3 flex-1 transition-colors duration-150',
          isOver ? 'bg-brand-50/15' : 'bg-canvas/20',
        )}>
          {isEmpty ? (
            <div className={cn(
              'flex-1 flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed py-12 transition-colors',
              isOver
                ? 'border-brand-300/60 bg-brand-50/20 text-brand-500'
                : 'border-hairline text-slate-300',
            )}>
              <Inbox className="h-5 w-5" strokeWidth={1.5} />
              <p className="text-[11px] font-medium text-center px-4 leading-relaxed">
                {isOver ? 'أفلت العميل هنا' : 'لا توجد فرص'}
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
