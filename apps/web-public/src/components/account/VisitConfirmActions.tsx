'use client';

import { useState, useTransition } from 'react';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import {
  confirmVisitAppointmentAction,
  requestVisitRescheduleAction,
} from '@/lib/account-actions';

type Mode = 'idle' | 'reason';
type Status = 'idle' | 'submitting' | 'error';

interface Props {
  appointmentId: string;
}

/**
 * Customer-facing confirm / request-reschedule actions for a single
 * appointment in the SCHEDULED state. Rendered only when the appointment
 * is actually waiting on the customer — the parent card decides that.
 *
 * Both actions are non-optimistic: on submit we show a spinner; on success
 * the server action revalidates /account/visits so the card re-renders with
 * the new status (CONFIRMED or PENDING_RESCHEDULE) and these buttons hide.
 * Errors are localized Arabic — never raw backend detail.
 */
export function VisitConfirmActions({ appointmentId }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [status, setStatus] = useState<Status>('idle');
  const [topError, setTopError] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setTopError('');
    setStatus('submitting');
    startTransition(async () => {
      const res = await confirmVisitAppointmentAction(appointmentId);
      if (!res.ok) {
        setStatus('error');
        setTopError(res.error);
      }
      // Success path: server action revalidates /account/visits, so the
      // parent re-renders without these buttons. No local state update
      // needed.
    });
  }

  function onSubmitReason(ev: React.FormEvent) {
    ev.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length > 0 && trimmed.length < 3) {
      setReasonError('السبب قصير جدًا — اتركه فارغًا أو اكتب جملة قصيرة.');
      return;
    }
    setReasonError('');
    setTopError('');
    setStatus('submitting');
    startTransition(async () => {
      const res = await requestVisitRescheduleAction(appointmentId, trimmed);
      if (!res.ok) {
        setStatus('error');
        setTopError(res.error);
      }
    });
  }

  const busy = status === 'submitting' || pending;

  if (mode === 'reason') {
    return (
      <form onSubmit={onSubmitReason} noValidate className="mt-4 space-y-3 rounded-xl bg-surface-soft p-4">
        <Field label="سبب طلب إعادة الجدولة (اختياري)">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            invalid={!!reasonError}
            placeholder="مثلاً: لدي ارتباط آخر في هذا الوقت."
            rows={3}
            maxLength={500}
          />
          <FormError>{reasonError}</FormError>
        </Field>

        {status === 'error' && topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="md" disabled={busy}>
            {busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={busy}
            onClick={() => {
              setMode('idle');
              setReason('');
              setReasonError('');
              setStatus('idle');
              setTopError('');
            }}
          >
            تراجع
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="md" onClick={onConfirm} disabled={busy}>
          <CalendarCheck className="h-5 w-5" aria-hidden />
          {busy ? 'جارٍ التأكيد…' : 'تأكيد الموعد'}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={() => setMode('reason')} disabled={busy}>
          <CalendarX className="h-5 w-5" aria-hidden />
          طلب إعادة جدولة
        </Button>
      </div>
      {status === 'error' && topError && <InlineNotice tone="error">{topError}</InlineNotice>}
    </div>
  );
}
