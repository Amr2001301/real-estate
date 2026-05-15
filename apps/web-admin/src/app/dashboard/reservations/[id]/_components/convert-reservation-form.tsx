'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/form/field';
import { convertReservationAction } from '../../actions';
import type { Reservation } from '@/lib/types';

interface Props {
  reservation: Pick<
    Reservation,
    | 'id'
    | 'status'
    | 'bookingAmount'
    | 'bookingPaymentStatus'
    | 'installmentPlanTemplateId'
    | 'selectedDurationMonths'
    | 'selectedIncreasePercentage'
    | 'snapshotDownPaymentAmount'
    | 'snapshotMonthlyInstallment'
    | 'snapshotTotalPayable'
  > & {
    clientName: string;
    unitCode: string;
  };
}

export function ConvertReservationForm({ reservation }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bookingAmount = Number(reservation.bookingAmount);
  const paymentBlocking =
    bookingAmount > 0 &&
    reservation.bookingPaymentStatus !== 'PAID' &&
    reservation.bookingPaymentStatus !== 'WAIVED';

  // A reservation linked to a plan template MUST have the full duration snapshot
  // before conversion. If any snapshot field is missing the backend will reject it
  // and the contract would be created with wrong amounts / no installment plan.
  const snapshotMissing =
    reservation.installmentPlanTemplateId != null &&
    (reservation.selectedDurationMonths == null ||
      reservation.snapshotDownPaymentAmount == null ||
      reservation.snapshotMonthlyInstallment == null ||
      reservation.snapshotTotalPayable == null);

  const needsStartDate = reservation.selectedDurationMonths != null;

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await convertReservationAction(reservation.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/contracts/${result.contractId}`);
    });
  }

  // Snapshot missing: show hard block, do not render the form at all.
  if (snapshotMissing) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          هذا الحجز قديم ولا يحتوي على مدة تقسيط محفوظة، لذلك لا يمكن تحويله إلى عقد حتى يتم تحديد مدة التقسيط.
          تواصل مع المسؤول لإضافة بيانات التقسيط يدوياً أو أعد إنشاء الحجز بالخطة المحدثة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full"
          onClick={() => setOpen(true)}
          disabled={paymentBlocking}
        >
          <ArrowLeftRight className="h-4 w-4 ml-2" />
          تحويل إلى عقد
        </Button>
      ) : null}

      {paymentBlocking && !open && (
        <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>يجب تأكيد سداد مبلغ الحجز أو إعفاؤه قبل التحويل إلى عقد.</p>
        </div>
      )}

      {open && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-brand-600" />
            تحويل الحجز إلى عقد
          </h3>

          {/* Read-only summary */}
          <dl className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">العميل</dt>
              <dd className="font-medium text-slate-800">{reservation.clientName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">الوحدة</dt>
              <dd className="font-medium text-slate-800">{reservation.unitCode}</dd>
            </div>
            {bookingAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">مبلغ الحجز</dt>
                <dd className="font-medium tabular-nums" dir="ltr">
                  {bookingAmount.toLocaleString('ar-SA')} ر.س
                  <span className="mr-1 text-slate-400">({reservation.bookingPaymentStatus})</span>
                </dd>
              </div>
            )}
            {reservation.snapshotDownPaymentAmount != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">الدفعة الأولى</dt>
                <dd className="font-medium tabular-nums" dir="ltr">
                  {Number(reservation.snapshotDownPaymentAmount).toLocaleString('ar-SA')} ر.س
                </dd>
              </div>
            )}
            {reservation.selectedDurationMonths != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">مدة التقسيط</dt>
                <dd className="font-medium tabular-nums">
                  {reservation.selectedDurationMonths} شهر
                  {reservation.selectedIncreasePercentage != null &&
                    ` — زيادة ${Number(reservation.selectedIncreasePercentage)}%`}
                </dd>
              </div>
            )}
            {reservation.snapshotMonthlyInstallment != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">القسط الشهري</dt>
                <dd className="font-bold tabular-nums text-brand-700" dir="ltr">
                  {Number(reservation.snapshotMonthlyInstallment).toLocaleString('ar-SA', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ر.س
                </dd>
              </div>
            )}
            {reservation.snapshotTotalPayable != null && (
              <div className="flex justify-between border-t border-hairline pt-2 mt-1">
                <dt className="text-slate-500">إجمالي السداد</dt>
                <dd className="font-bold tabular-nums text-slate-900" dir="ltr">
                  {Number(reservation.snapshotTotalPayable).toLocaleString('ar-SA')} ر.س
                </dd>
              </div>
            )}
          </dl>

          {/* Form inputs */}
          <form action={handleSubmit} className="space-y-3">
            {needsStartDate && (
              <Field
                label="تاريخ بدء التقسيط"
                name="startsAt"
                required
                hint="سيُطبَّق على جميع أقساط العقد"
              >
                <input
                  name="startsAt"
                  type="date"
                  required
                  className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </Field>
            )}

            <Field label="تاريخ توقيع العقد (اختياري)" name="signedAt">
              <input
                name="signedAt"
                type="datetime-local"
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </Field>

            <Field label="رابط PDF (اختياري)" name="pdfUrl">
              <input
                name="pdfUrl"
                type="url"
                dir="ltr"
                placeholder="https://..."
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? 'جارٍ التحويل…' : 'تأكيد التحويل'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setOpen(false); setError(null); }}
                disabled={isPending}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
