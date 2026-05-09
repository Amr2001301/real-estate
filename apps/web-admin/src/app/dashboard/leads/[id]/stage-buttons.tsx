'use client';

import { useTransition } from 'react';
import type { LeadStage } from '@/lib/types';
import { updateStageAction } from '../actions';

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

export function StageButtons({ leadId, currentStage, stages }: Props) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => {
        const active = s === currentStage;
        return (
          <button
            key={s}
            type="button"
            disabled={pending || active}
            onClick={() => start(() => updateStageAction(leadId, s))}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } disabled:opacity-60`}
          >
            {LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
