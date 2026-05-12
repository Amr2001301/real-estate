'use client';

import { useActionState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { rescheduleVisitAction } from '../actions';

interface Props {
  appointmentId: string;
  salesOptions: { id: string; fullName: string }[];
  currentSalesId?: string | null;
  currentScheduledAt?: string;
  open: boolean;
  onClose: () => void;
}

const INITIAL = { error: null as string | null };

export function RescheduleModal({
  appointmentId,
  salesOptions,
  currentSalesId,
  currentScheduledAt,
  open,
  onClose,
}: Props) {
  const action = rescheduleVisitAction.bind(null, appointmentId);
  const [state, dispatch, pending] = useActionState(
    async (_prev: typeof INITIAL, fd: FormData) => {
      try {
        await action(fd);
        onClose();
        return INITIAL;
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    INITIAL,
  );

  const defaultDate = currentScheduledAt ? currentScheduledAt.slice(0, 16) : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="إعادة جدولة الزيارة"
      description="سيتم تعيين الموعد الحالي كـ 'معاد جدولته' وإنشاء موعد جديد"
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" size="sm" type="submit" form="reschedule-form" loading={pending}>
            إعادة الجدولة
          </Button>
        </>
      }
    >
      <form id="reschedule-form" action={dispatch} className="space-y-4">
        {state.error && (
          <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            الموعد الجديد <span className="text-danger-600">*</span>
          </label>
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            defaultValue={defaultDate}
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </div>

        {salesOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المندوب</label>
            <select
              name="assignedSalesId"
              defaultValue={currentSalesId ?? ''}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            >
              <option value="">غير محدد</option>
              {salesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الموقع</label>
          <input
            name="location"
            type="text"
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
          <textarea
            name="salesNotes"
            rows={2}
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
}
