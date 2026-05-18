'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  approvePayoutAction,
  processPayoutAction,
  markPayoutPaidAction,
  cancelPayoutAction,
  type BrokerPayoutActionState,
} from '../actions';

function Banner({ state }: { state: BrokerPayoutActionState }) {
  if (state.error) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="font-medium">{state.error}</p>
      </div>
    );
  }
  if (state.ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-success-50 border border-success-100 text-success-700 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="font-medium">تم الحفظ</p>
      </div>
    );
  }
  return null;
}

export function ApprovePayoutForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    approvePayoutAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="ملاحظة" name="notes">
        <Textarea id={`approve-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>اعتماد الدفعة</SubmitButton>
      </div>
    </form>
  );
}

export function ProcessPayoutForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    processPayoutAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="طريقة الدفع" name="paymentMethod" hint="اختياري — يمكن ضبطها لاحقاً عند الصرف">
        <Select id={`process-method-${id}`} name="paymentMethod" defaultValue="">
          <option value="">— لا تحدد —</option>
          <option value="BANK_TRANSFER">تحويل بنكي</option>
          <option value="CHEQUE">شيك</option>
          <option value="CASH">نقدي</option>
          <option value="OTHER">أخرى</option>
        </Select>
      </Field>
      <Field label="تاريخ الصرف المخطط" name="scheduledAt">
        <Input id={`process-sched-${id}`} name="scheduledAt" type="date" />
      </Field>
      <Field label="ملاحظة" name="notes">
        <Textarea id={`process-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>بدء التنفيذ</SubmitButton>
      </div>
    </form>
  );
}

export function MarkPaidPayoutForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    markPayoutPaidAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="طريقة الدفع" name="paymentMethod" required>
        <Select id={`paid-method-${id}`} name="paymentMethod" required defaultValue="">
          <option value="" disabled>اختر</option>
          <option value="BANK_TRANSFER">تحويل بنكي</option>
          <option value="CHEQUE">شيك</option>
          <option value="CASH">نقدي</option>
          <option value="OTHER">أخرى</option>
        </Select>
      </Field>
      <Field label="مرجع الدفع" name="paymentReference" hint="اختياري — رقم العملية البنكية أو الشيك">
        <Input id={`paid-ref-${id}`} name="paymentReference" dir="ltr" />
      </Field>
      <Field label="رابط إيصال الدفع" name="receiptUrl">
        <Input id={`paid-receipt-${id}`} name="receiptUrl" type="url" dir="ltr" placeholder="https://…" />
      </Field>
      <Field label="تاريخ الدفع" name="paidAt" hint="اختياري — افتراضي تاريخ اليوم">
        <Input id={`paid-at-${id}`} name="paidAt" type="date" />
      </Field>
      <Field label="ملاحظة" name="notes">
        <Textarea id={`paid-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>تسجيل كمدفوع</SubmitButton>
      </div>
    </form>
  );
}

export function CancelPayoutForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    cancelPayoutAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="سبب الإلغاء" name="reason" required>
        <Textarea id={`cancel-${id}`} name="reason" rows={3} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="danger">إلغاء الدفعة</SubmitButton>
      </div>
    </form>
  );
}
