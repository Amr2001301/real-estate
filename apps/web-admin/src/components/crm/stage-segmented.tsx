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

const TONE: Record<LeadStage, string> = {
  NEW: 'data-[active=true]:bg-slate-700 data-[active=true]:text-white',
  INTERESTED: 'data-[active=true]:bg-info-600 data-[active=true]:text-white',
  VISIT: 'data-[active=true]:bg-purple-600 data-[active=true]:text-white',
  NEGOTIATION: 'data-[active=true]:bg-brand-600 data-[active=true]:text-white',
  WON: 'data-[active=true]:bg-success-600 data-[active=true]:text-white',
  LOST: 'data-[active=true]:bg-danger-600 data-[active=true]:text-white',
};

interface Props {
  leadId: string;
  currentStage: LeadStage;
  stages: LeadStage[];
}

export function StageSegmented({ leadId, currentStage, stages }: Props) {
  const [pending, start] = useTransition();
  return (
    <div
      role="group"
      className="inline-flex flex-wrap items-center gap-1 rounded-2xl bg-surface-muted p-1 ring-1 ring-inset ring-hairline"
    >
      {stages.map((s) => {
        const active = s === currentStage;
        return (
          <button
            key={s}
            type="button"
            data-active={active ? 'true' : undefined}
            disabled={pending || active}
            onClick={() =>
              start(async () => {
                try {
                  await updateStageAction(leadId, s);
                } catch (e) {
                  alert((e as Error).message);
                }
              })
            }
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold',
              'text-slate-600 hover:text-slate-900 hover:bg-surface transition-colors',
              'data-[active=true]:shadow-sm',
              'disabled:cursor-not-allowed disabled:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              TONE[s],
            )}
          >
            {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            {LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
