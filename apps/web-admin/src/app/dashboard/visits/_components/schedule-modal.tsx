'use client';

import { useActionState, useRef } from 'react';
import { Building2, User } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { scheduleVisitAction } from '../actions';
import type { Translatable } from '@/lib/types';
import { tx } from '@/lib/format';

interface Props {
  requestId: string;
  salesOptions: { id: string; fullName: string }[];
  open: boolean;
  onClose: () => void;
  project?: { name: Translatable } | null;
  unit?: { code: string; type: string } | null;
  customerName?: string | null;
  defaultSalesId?: string | null;
}

// 30-minute Arabic time slots 06:00 – 22:00
const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;
      const period = h < 12 ? 'ص' : 'م';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayH}:${mm} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

const INITIAL = { error: null as string | null };

export function ScheduleModal({
  requestId,
  salesOptions,
  open,
  onClose,
  project,
  unit,
  customerName,
  defaultSalesId,
}: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);

  const action = scheduleVisitAction.bind(null, requestId);
  const [state, dispatch, pending] = useActionState(
    async (_prev: typeof INITIAL, fd: FormData) => {
      const date = fd.get('_date') as string;
      const time = fd.get('_time') as string;
      if (!date || !time) return { error: 'يرجى تحديد التاريخ والوقت' };
      fd.set('scheduledAt', `${date}T${time}:00`);
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="جدولة زيارة"
      description="أدخل تفاصيل الموعد لتحويل الطلب إلى زيارة مجدولة"
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" size="sm" type="submit" form="schedule-form" loading={pending}>
            جدولة
          </Button>
        </>
      }
    >
      <form id="schedule-form" action={dispatch} className="space-y-4">
        {/* Read-only context */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2 text-sm">
          {customerName && (
            <div className="flex items-center gap-2 text-slate-700">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-medium">{customerName}</span>
            </div>
          )}
          {project && (
            <div className="flex items-center gap-2 text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {tx(project.name)}
                {unit && (
                  <span className="text-slate-400 mx-1">·</span>
                )}
                {unit && (
                  <span className="text-slate-500">{unit.code} — {unit.type}</span>
                )}
              </span>
            </div>
          )}
        </div>

        {state.error && (
          <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
        )}

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              التاريخ <span className="text-danger-600">*</span>
            </label>
            <input
              ref={dateRef}
              name="_date"
              type="date"
              required
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              الوقت <span className="text-danger-600">*</span>
            </label>
            <select
              ref={timeRef}
              name="_time"
              required
              defaultValue=""
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
            >
              <option value="" disabled>اختر الوقت</option>
              {TIME_SLOTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {salesOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المندوب</label>
            <select
              name="assignedSalesId"
              defaultValue={defaultSalesId ?? ''}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المدة (دقيقة)</label>
            <input
              name="durationMinutes"
              type="number"
              min={15}
              placeholder="60"
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الموقع</label>
            <input
              name="location"
              type="text"
              placeholder="عنوان موقع الزيارة"
              defaultValue={project ? tx(project.name) : ''}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">نقطة الالتقاء</label>
          <input
            name="meetingPoint"
            type="text"
            placeholder="مثال: مدخل المبنى الرئيسي"
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات المندوب</label>
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
