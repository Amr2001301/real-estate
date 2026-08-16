import { Activity } from 'lucide-react';
import type { ReservationActivity, ReservationActivityType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

const TYPE_COLORS: Record<ReservationActivityType, string> = {
  CREATED: 'bg-brand-500',
  APPROVED: 'bg-success-500',
  REJECTED: 'bg-danger-500',
  CANCELLED: 'bg-danger-400',
  EXPIRED: 'bg-amber-500',
  NOTE_ADDED: 'bg-slate-400',
  BOOKING_PAYMENT_CONFIRMED: 'bg-success-500',
  BOOKING_PAYMENT_UNCONFIRMED: 'bg-amber-500',
  CONVERTED: 'bg-indigo-500',
};

interface Props {
  activities: ReservationActivity[];
  locale?: Locale;
}

export function ReservationTimeline({ activities, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.reservationDetailPage;

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
        const label = m.timelineLabels[a.type] ?? a.type;
        return (
          <div key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${dotColor}`} />
              {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {label}
              </p>
              {a.note && <p className="text-xs text-slate-600 mt-0.5">{a.note}</p>}
              <div className="flex items-center gap-2 mt-1">
                {a.actor && (
                  <span className="text-xs text-slate-500">{a.actor.fullName}</span>
                )}
                {!a.actor && a.actorId === null && (
                  <span className="text-xs text-slate-400">{m.timelineSystemActor}</span>
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

export function ReservationTimelineCard({ activities, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">{m.sectionActivity}</h2>
        <span className="ms-auto text-2xs font-semibold text-slate-400">
          {activities.length}
        </span>
      </div>
      <ReservationTimeline activities={activities} locale={locale} />
    </div>
  );
}
