import { Activity } from 'lucide-react';
import type { VisitActivity, VisitActivityType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

const TYPE_LABELS: Record<VisitActivityType, string> = {
  REQUEST_CREATED: 'تم إنشاء الطلب',
  REQUEST_REVIEWED: 'تمت مراجعة الطلب',
  REQUEST_REJECTED: 'تم رفض الطلب',
  REQUEST_CANCELLED: 'تم إلغاء الطلب',
  VISIT_SCHEDULED: 'تمت جدولة الزيارة',
  VISIT_CONFIRMED: 'تم تأكيد الزيارة',
  VISIT_COMPLETED: 'اكتملت الزيارة',
  VISIT_CANCELLED: 'تم إلغاء الزيارة',
  VISIT_NO_SHOW: 'لم يحضر العميل',
  VISIT_RESCHEDULED: 'تمت إعادة جدولة الزيارة',
  SALES_ASSIGNED: 'تم تعيين مندوب',
  NOTE_ADDED: 'تمت إضافة ملاحظة',
};

const TYPE_COLORS: Partial<Record<VisitActivityType, string>> = {
  VISIT_COMPLETED: 'bg-success-500',
  VISIT_CANCELLED: 'bg-danger-500',
  VISIT_NO_SHOW: 'bg-amber-500',
  REQUEST_REJECTED: 'bg-danger-400',
  VISIT_SCHEDULED: 'bg-brand-500',
  VISIT_CONFIRMED: 'bg-purple-500',
};

interface Props {
  activities: VisitActivity[];
}

export function VisitTimeline({ activities }: Props) {
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
            <div className={`pb-4 min-w-0 ${isLast ? '' : ''}`}>
              <p className="text-sm font-medium text-slate-900">
                {TYPE_LABELS[a.type] ?? a.type}
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

export function VisitTimelineCard({ activities }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">سجل الأحداث</h2>
        <span className="ms-auto text-2xs font-semibold text-slate-400">
          {activities.length} حدث
        </span>
      </div>
      <VisitTimeline activities={activities} />
    </div>
  );
}
