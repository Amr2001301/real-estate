'use client';

import { useActionState, useRef } from 'react';
import { Building2, MessageSquare, User } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { scheduleVisitAction } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';
import type { Translatable } from '@/lib/types';
import { tx } from '@/lib/format';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

interface Props {
  requestId: string;
  salesOptions: { id: string; fullName: string; role?: 'SALES' | 'SALES_MANAGER' }[];
  open: boolean;
  onClose: () => void;
  project?: { name: Translatable } | null;
  unit?: { code: string; type: string } | null;
  customerName?: string | null;
  defaultSalesId?: string | null;
  /** Customer's submitted preferred datetime — seeds the date input. */
  preferredDate?: string | null;
  /** Customer's submitted preferred HH:mm — seeds the time select. Falls back
   *  to the time portion of `preferredDate` when null. */
  preferredTime?: string | null;
  /** Customer's free-text message — rendered read-only above the form so the
   *  admin can see context without leaving the dialog. */
  customerMessage?: string | null;
  locale?: Locale;
}

function buildTimeSlots(am: string, pm: string): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const min of [0, 30]) {
      if (h === 22 && min === 30) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(min).padStart(2, '0');
      const value = `${hh}:${mm}`;
      const period = h < 12 ? am : pm;
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayH}:${mm} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
}

const INITIAL = { error: null as string | null };

/** Extract a YYYY-MM-DD string from an ISO timestamp for the date input.
 *  Returns '' when the input isn't parseable so the form falls back to empty. */
function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Extract HH:mm in 30-minute increments, snapped to the nearest slot the form
 *  exposes so the customer's preferred time matches a selectable option. */
function snapToHalfHour(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  const snapped = Math.round(totalMinutes / 30) * 30;
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  if (h < 6 || h > 22 || (h === 22 && m > 0)) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ScheduleModal({
  requestId,
  salesOptions,
  open,
  onClose,
  project,
  unit,
  customerName,
  defaultSalesId,
  preferredDate,
  preferredTime,
  customerMessage,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.visitComponents;
  const TIME_SLOTS = buildTimeSlots(m.timePeriodAM, m.timePeriodPM);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);

  // Seed the date+time pickers from what the customer asked for.
  const defaultDate = dateInputValue(preferredDate);
  const defaultTime =
    (preferredTime && /^\d{2}:\d{2}$/.test(preferredTime) ? preferredTime : '') ||
    snapToHalfHour(preferredDate);

  const action = scheduleVisitAction.bind(null, requestId);
  const [state, dispatch, pending] = useActionState(
    async (_prev: typeof INITIAL, fd: FormData) => {
      const date = fd.get('_date') as string;
      const time = fd.get('_time') as string;
      if (!date || !time) return { error: m.dateTimeRequired };
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
      title={m.scheduleTitle}
      description={m.scheduleDesc}
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {m.cancelModalBtn}
          </Button>
          <Button variant="primary" size="sm" type="submit" form="schedule-form" loading={pending}>
            {m.scheduleSubmitBtn}
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
          {customerMessage && (
            <div className="flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-200/60">
              <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap leading-relaxed">{customerMessage}</span>
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
              {m.dateLabel} <span className="text-danger-600">*</span>
            </label>
            <input
              ref={dateRef}
              name="_date"
              type="date"
              required
              defaultValue={defaultDate}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {m.timeLabel} <span className="text-danger-600">*</span>
            </label>
            <select
              ref={timeRef}
              name="_time"
              required
              defaultValue={defaultTime}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
            >
              <option value="" disabled>{m.chooseTimePlaceholder}</option>
              {TIME_SLOTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {salesOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{m.salesRepLabel}</label>
            <select
              name="assignedSalesId"
              defaultValue={defaultSalesId ?? ''}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
            >
              <option value="">{m.unspecified}</option>
              {salesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {salesActorLabel(s)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{m.durationLabel}</label>
            <input
              name="durationMinutes"
              type="number"
              min={15}
              placeholder="60"
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{m.locationFieldLabel}</label>
            <input
              name="location"
              type="text"
              placeholder={m.locationPlaceholder}
              defaultValue={project ? tx(project.name) : ''}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{m.meetingPointLabel}</label>
          <input
            name="meetingPoint"
            type="text"
            placeholder={m.meetingPointPlaceholder}
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{m.salesNotesLabel}</label>
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
