import { Activity } from 'lucide-react';
import type { ReservationActivity, ReservationActivityType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumEmptyNote } from '@/components/premium';

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
    return <PremiumEmptyNote>{m.timelineEmpty}</PremiumEmptyNote>;
  }

  return (
    <ol data-testid="reservation-timeline" className="max-h-[420px] overflow-y-auto">
      {activities.map((a, i) => {
        const isLast = i === activities.length - 1;
        const dotColor = TYPE_COLORS[a.type] ?? 'bg-slate-400';
        const label = m.timelineLabels[a.type] ?? a.type;
        return (
          <li key={a.id} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-hairline">
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              </span>
              {!isLast && <span className="my-1 w-px flex-1 bg-hairline" />}
            </div>
            <div className="min-w-0 pb-5">
              <p className="text-[13.5px] font-semibold text-slate-900">{label}</p>
              {a.note && <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{a.note}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
                <span className="font-semibold">
                  {a.actor ? a.actor.fullName : a.actorId === null ? m.timelineSystemActor : ''}
                </span>
                {(a.actor || a.actorId === null) && <span className="text-slate-400">·</span>}
                <span className="tabular-nums">{formatDateTime(a.createdAt, locale)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
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
