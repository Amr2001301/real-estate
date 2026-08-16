'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  approvePayoutAction,
  processPayoutAction,
  markPayoutPaidAction,
  cancelPayoutAction,
  type BrokerPayoutActionState,
} from '../actions';

function Banner({ state, savedOk }: { state: BrokerPayoutActionState; savedOk: string }) {
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
        <p className="font-medium">{savedOk}</p>
      </div>
    );
  }
  return null;
}

export function ApprovePayoutForm({ id, locale = 'ar' }: { id: string; locale?: Locale }) {
  const m = uiT(locale).pages.brokerPayoutDetail;
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    approvePayoutAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} savedOk={m.savedOk} />
      <Field label={m.formNoteLabel} name="notes">
        <Textarea id={`approve-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{m.btnApprovePayout}</SubmitButton>
      </div>
    </form>
  );
}

export function ProcessPayoutForm({ id, locale = 'ar' }: { id: string; locale?: Locale }) {
  const m = uiT(locale).pages.brokerPayoutDetail;
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    processPayoutAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} savedOk={m.savedOk} />
      <Field label={m.formPaymentMethodLabel} name="paymentMethod" hint={m.formPaymentMethodHint}>
        <Select id={`process-method-${id}`} name="paymentMethod" defaultValue="">
          <option value="">{m.formNoMethodOption}</option>
          <option value="BANK_TRANSFER">{m.methodBankTransfer}</option>
          <option value="CHEQUE">{m.methodCheque}</option>
          <option value="CASH">{m.methodCash}</option>
          <option value="OTHER">{m.methodOther}</option>
        </Select>
      </Field>
      <Field label={m.formScheduledAtLabel} name="scheduledAt">
        <Input id={`process-sched-${id}`} name="scheduledAt" type="date" />
      </Field>
      <Field label={m.formNoteLabel} name="notes">
        <Textarea id={`process-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{m.btnProcess}</SubmitButton>
      </div>
    </form>
  );
}

export function MarkPaidPayoutForm({ id, locale = 'ar' }: { id: string; locale?: Locale }) {
  const m = uiT(locale).pages.brokerPayoutDetail;
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    markPayoutPaidAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} savedOk={m.savedOk} />
      <Field label={m.formPaymentMethodLabel} name="paymentMethod" required>
        <Select id={`paid-method-${id}`} name="paymentMethod" required defaultValue="">
          <option value="" disabled>{m.selectMethodPlaceholder}</option>
          <option value="BANK_TRANSFER">{m.methodBankTransfer}</option>
          <option value="CHEQUE">{m.methodCheque}</option>
          <option value="CASH">{m.methodCash}</option>
          <option value="OTHER">{m.methodOther}</option>
        </Select>
      </Field>
      <Field label={m.formPaymentReferenceLabel} name="paymentReference" hint={m.formPaymentReferenceHint}>
        <Input id={`paid-ref-${id}`} name="paymentReference" dir="ltr" />
      </Field>
      <Field label={m.formReceiptUrlLabel} name="receiptUrl">
        <Input id={`paid-receipt-${id}`} name="receiptUrl" type="url" dir="ltr" placeholder="https://…" />
      </Field>
      <Field label={m.formPaidAtLabel} name="paidAt" hint={m.formPaidAtHint}>
        <Input id={`paid-at-${id}`} name="paidAt" type="date" />
      </Field>
      <Field label={m.formNoteLabel} name="notes">
        <Textarea id={`paid-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{m.btnMarkPaid}</SubmitButton>
      </div>
    </form>
  );
}

export function CancelPayoutForm({ id, locale = 'ar' }: { id: string; locale?: Locale }) {
  const m = uiT(locale).pages.brokerPayoutDetail;
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    cancelPayoutAction.bind(null, id),
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!window.confirm(m.confirmCancel)) {
          e.preventDefault();
        }
      }}
    >
      <Banner state={state} savedOk={m.savedOk} />
      <Field label={m.formCancelReasonLabel} name="reason" required>
        <Textarea id={`cancel-${id}`} name="reason" rows={3} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="danger">{m.btnCancelPayout}</SubmitButton>
      </div>
    </form>
  );
}
