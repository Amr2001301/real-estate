'use client';

import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/form/field';
import { updateReservationAction } from '../../actions';
import { salesActorLabel } from '@/lib/sales-actor';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface SalesUser {
  id: string;
  fullName: string;
  role?: 'SALES' | 'SALES_MANAGER';
}

interface Props {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  currentSalesId: string;
  currentNotes: string | null;
  salesOptions: SalesUser[];
  locale?: Locale;
}

export function EditReservationDialog({
  open,
  onClose,
  reservationId,
  currentSalesId,
  currentNotes,
  salesOptions,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const [pending, startTransition] = useTransition();
  const [salesId, setSalesId] = useState(currentSalesId);
  const [expiresInHours, setExpiresInHours] = useState('');
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    if (salesId && salesId !== currentSalesId) fd.set('salesId', salesId);
    if (expiresInHours) fd.set('expiresInHours', expiresInHours);
    if (notes !== (currentNotes ?? '')) fd.set('notes', notes);

    if (![...fd.keys()].length) {
      setError(m.editNoChangeError);
      return;
    }

    startTransition(async () => {
      const result = await updateReservationAction(reservationId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setExpiresInHours('');
      setError(null);
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={m.editDialogTitle}
      description={m.editDialogDesc}
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            {m.editCancelBtn}
          </Button>
          <Button variant="primary" size="sm" loading={pending} onClick={handleSubmit}>
            {m.editSaveBtn}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={m.editSalesLabel} name="salesId">
          <Select
            name="salesId"
            value={salesId}
            onChange={(e) => setSalesId(e.target.value)}
            disabled={pending}
          >
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {salesActorLabel(s)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={m.editExpiryLabel}
          name="expiresInHours"
          hint={m.editExpiryHint}
        >
          <Select
            name="expiresInHours"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            disabled={pending}
          >
            <option value="">{m.editExpiryNoChange}</option>
            <option value="24">{m.editHour24}</option>
            <option value="48">{m.editHour48}</option>
            <option value="72">{m.editHour72}</option>
            <option value="120">{m.editHour120}</option>
            <option value="168">{m.editHour168}</option>
            <option value="336">{m.editHour336}</option>
          </Select>
        </Field>

        <Field label={m.editNotesLabel} name="notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            placeholder={m.editNotesPH}
          />
        </Field>

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
