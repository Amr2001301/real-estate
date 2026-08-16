import { Activity } from 'lucide-react';
import type { VisitActivity, VisitActivityType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

const TYPE_COLORS: Partial<Record<VisitActivityType, string>> = {
  VISIT_COMPLETED: 'bg-success-500',
  VISIT_CANCELLED: 'bg-danger-500',
  VISIT_NO_SHOW: 'bg-amber-500',
  REQUEST_REJECTED: 'bg-danger-400',
  VISIT_SCHEDULED: 'bg-brand-500',
  VISIT_CONFIRMED: 'bg-purple-500',
  CUSTOMER_CONFIRMED: 'bg-purple-600',
  CUSTOMER_RESCHEDULE_REQUESTED: 'bg-amber-500',
  REMINDER_SENT: 'bg-blue-400',
  SALES_REASSIGNED: 'bg-slate-500',
};

interface Props {
  activities: VisitActivity[];
  locale?: Locale;
}

export function VisitTimeline({ activities, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.visitComponents;

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">{m.timelineEmpty}</div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((a, i) => {
        const isLast = i === activities.length - 1;
        const dotColor = TYPE_COLORS[a.type] ?? 'bg-slate-400';
        return (
          <div key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${dotColor}`} />
              {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className={`pb-4 min-w-0 ${isLast ? '' : ''}`}>
              <p className="text-sm font-medium text-slate-900">
                {m.activityLabels[a.type] ?? a.type}
              </p>
              {a.note && (
                <p className="text-xs text-slate-600 mt-0.5">{a.note}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {a.actor && (
                  <span className="text-xs text-slate-500">{a.actor.fullName}</span>
                )}
                <span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VisitTimelineCard({ activities, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.visitComponents;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">{m.timelineTitle}</h2>
        <span className="ms-auto text-2xs font-semibold text-slate-400">
          {activities.length} {m.timelineEventSuffix}
        </span>
      </div>
      <VisitTimeline activities={activities} locale={locale} />
    </div>
  );
}
