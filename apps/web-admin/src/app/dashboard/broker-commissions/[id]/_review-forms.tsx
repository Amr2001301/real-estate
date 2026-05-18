'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Textarea } from '@/components/ui/textarea';
import {
  approveBrokerCommissionAction,
  rejectBrokerCommissionAction,
  cancelBrokerCommissionAction,
  type BrokerCommissionActionState,
} from '../actions';

function Banner({ state }: { state: BrokerCommissionActionState }) {
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

export function ApproveCommissionForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerCommissionActionState, FormData>(
    approveBrokerCommissionAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="ملاحظة" name="notes" hint="اختياري — ستضاف إلى ملاحظات العمولة">
        <Textarea id={`approve-notes-${id}`} name="notes" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>اعتماد العمولة</SubmitButton>
      </div>
    </form>
  );
}

export function RejectCommissionForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerCommissionActionState, FormData>(
    rejectBrokerCommissionAction.bind(null, id),
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!window.confirm('سيتم رفض العمولة. هل أنت متأكد؟')) e.preventDefault();
      }}
    >
      <Banner state={state} />
      <Field label="سبب الرفض" name="reason" required>
        <Textarea id={`reject-${id}`} name="reason" rows={3} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="danger">رفض</SubmitButton>
      </div>
    </form>
  );
}

export function CancelCommissionForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<BrokerCommissionActionState, FormData>(
    cancelBrokerCommissionAction.bind(null, id),
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!window.confirm('سيتم إلغاء العمولة. هل أنت متأكد؟')) e.preventDefault();
      }}
    >
      <Banner state={state} />
      <Field label="سبب الإلغاء" name="reason" required>
        <Textarea id={`cancel-${id}`} name="reason" rows={3} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary">إلغاء العمولة</SubmitButton>
      </div>
    </form>
  );
}
