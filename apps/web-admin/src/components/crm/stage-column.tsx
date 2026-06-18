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

      {/* Text-only header with a single small dot for stage identity */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0', DOT[tone])} />
          <h3 className="text-[13px] font-bold text-slate-800">{label}</h3>
        </div>
        <span className="text-[11px] font-black text-slate-400 tabular-nums">{count}</span>
      </div>

      {/* Lane — cards sit on a subtle gray surface */}
      <div className={cn(
        'flex flex-col gap-2.5 rounded-2xl p-2.5 min-h-[300px] transition-all duration-150',
        isOver
          ? 'bg-slate-200/70 ring-1 ring-inset ring-slate-300/70'
          : 'bg-slate-100/60',
      )}>
        {isEmpty ? (
          <div className={cn(
            'flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 transition-colors',
            isOver
              ? 'border-slate-400/50 bg-slate-100/60 text-slate-500'
              : 'border-slate-200 text-slate-300',
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
  );
}
