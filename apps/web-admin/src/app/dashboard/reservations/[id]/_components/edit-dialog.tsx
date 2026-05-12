'use client';

import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/form/field';
import { updateReservationAction } from '../../actions';

interface SalesUser {
  id: string;
  fullName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  currentSalesId: string;
  currentNotes: string | null;
  salesOptions: SalesUser[];
}

export function EditReservationDialog({
  open,
  onClose,
  reservationId,
  currentSalesId,
  currentNotes,
  salesOptions,
}: Props) {
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
      setError('لا يوجد تعديل لحفظه');
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
      title="تعديل الحجز"
      description="يمكن تعديل المندوب وصلاحية الحجز والملاحظات أثناء حالة قيد المراجعة فقط."
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="primary" size="sm" loading={pending} onClick={handleSubmit}>
            حفظ التعديلات
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="المندوب المسؤول" name="salesId">
          <Select
            name="salesId"
            value={salesId}
            onChange={(e) => setSalesId(e.target.value)}
            disabled={pending}
          >
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="تمديد الصلاحية"
          name="expiresInHours"
          hint="اختر مدة جديدة محسوبة من الآن. اتركها فارغة لعدم التغيير."
        >
          <Select
            name="expiresInHours"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            disabled={pending}
          >
            <option value="">— بدون تغيير —</option>
            <option value="24">24 ساعة (يوم)</option>
            <option value="48">48 ساعة (يومان)</option>
            <option value="72">72 ساعة (3 أيام)</option>
            <option value="120">120 ساعة (5 أيام)</option>
            <option value="168">168 ساعة (أسبوع)</option>
            <option value="336">336 ساعة (أسبوعان)</option>
          </Select>
        </Field>

        <Field label="ملاحظات داخلية" name="notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            placeholder="ملاحظات الحجز…"
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
