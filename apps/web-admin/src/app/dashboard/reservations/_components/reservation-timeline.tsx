import { Activity } from 'lucide-react';
import type { ReservationActivity, ReservationActivityType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

const TYPE_LABELS: Record<ReservationActivityType, string> = {
  CREATED: 'تم إنشاء الحجز',
  APPROVED: 'تمت الموافقة على الحجز',
  REJECTED: 'تم رفض الحجز',
  CANCELLED: 'تم إلغاء الحجز',
  EXPIRED: 'انتهت صلاحية الحجز',
  NOTE_ADDED: 'تمت إضافة ملاحظة',
  BOOKING_PAYMENT_CONFIRMED: 'تم تأكيد سداد مبلغ الحجز',
  BOOKING_PAYMENT_UNCONFIRMED: 'تم إلغاء تأكيد سداد مبلغ الحجز',
  CONVERTED: 'تم تحويل الحجز إلى عقد',
};

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
}

export function ReservationTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">لا توجد أحداث بعد</div>
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
            <div className="pb-4 min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {TYPE_LABELS[a.type] ?? a.type}
              </p>
              {a.note && <p className="text-xs text-slate-600 mt-0.5">{a.note}</p>}
              <div className="flex items-center gap-2 mt-1">
                {a.actor && (
                  <span className="text-xs text-slate-500">{a.actor.fullName}</span>
                )}
                {!a.actor && a.actorId === null && (
                  <span className="text-xs text-slate-400">النظام</span>
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

export function ReservationTimelineCard({ activities }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">سجل الأحداث</h2>
        <span className="ms-auto text-2xs font-semibold text-slate-400">
          {activities.length} حدث
        </span>
      </div>
      <ReservationTimeline activities={activities} />
    </div>
  );
}
