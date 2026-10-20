'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import type { LeadStage } from '@/lib/types';
import { cn } from '@/lib/cn';
import { updateStageAction } from '@/app/dashboard/leads/actions';

const LABELS: Record<LeadStage, string> = {
  NEW: 'جديد',
  INTERESTED: 'مهتم',
  VISIT: 'زيارة',
  NEGOTIATION: 'تفاوض',
  WON: 'فوز',
  LOST: 'خسارة',
};

interface Props {
  leadId: string;
  currentStage: LeadStage;
  stages: LeadStage[];
}

export function StageSegmented({ leadId, currentStage, stages }: Props) {
  const [pending, start] = useTransition();
  // The path stages run in order; LOST sits apart at the end.
  const path = stages.filter((s): s is Exclude<LeadStage, 'LOST'> => s !== 'LOST');
  const at = path.indexOf(currentStage as Exclude<LeadStage, 'LOST'>);
  const lost = currentStage === 'LOST';
  const move = (s: LeadStage) =>
    start(async () => {
      try {
        await updateStageAction(leadId, s);
      } catch (e) {
        alert((e as Error).message);
      }
    });

  return (
    <div role="group" data-testid="stage-journey" className="flex flex-wrap items-center gap-3">
      <ol className="flex min-w-0 flex-1 items-center">
        {path.map((s, i) => {
          const active = s === currentStage;
          const done = !lost && at >= 0 && i < at;
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center last:flex-none">
              <button
                type="button"
                data-active={active ? 'true' : undefined}
                disabled={pending || active}
                onClick={() => move(s)}
                className={cn(
                  'group inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-3.5 ps-1.5 text-[12.5px] font-semibold transition-colors',
                  'disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? s === 'WON'
                      ? 'bg-emerald-500/12 text-emerald-600'
                      : 'bg-brand-500/12 text-brand-700'
                    : done
                      ? 'text-slate-700 hover:bg-surface-muted'
                      : 'text-slate-500 hover:bg-surface-muted hover:text-slate-900',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                    active
                      ? s === 'WON'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-br from-brand-400 to-brand-600 text-[#1a1408]'
                      : done
                        ? 'bg-brand-500/20 text-brand-700'
                        : 'bg-surface-muted text-slate-500 ring-1 ring-hairline',
                  )}
                >
                  {done || (active && s === 'WON') ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {LABELS[s]}
              </button>
              {i < path.length - 1 && (
                <span
                  aria-hidden
                  className={cn('mx-1.5 h-[2px] min-w-4 flex-1 rounded-full', done ? 'bg-brand-500/60' : 'bg-hairline')}
                />
              )}
            </li>
          );
        })}
      </ol>
      {stages.includes('LOST') && (
        <button
          type="button"
          data-active={lost ? 'true' : undefined}
          disabled={pending || lost}
          onClick={() => move('LOST')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-default',
            lost
              ? 'border-danger-500/40 bg-danger-500/12 text-danger-600'
              : 'border-hairline text-slate-500 hover:border-danger-500/40 hover:text-danger-600',
          )}
        >
          {lost && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          {LABELS.LOST}
        </button>
      )}
    </div>
  );
}
