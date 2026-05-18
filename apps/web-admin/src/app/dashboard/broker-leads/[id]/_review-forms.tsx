'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  approveBrokerLeadAction,
  rejectBrokerLeadAction,
  markBrokerLeadDuplicateAction,
  type BrokerLeadActionState,
} from '../actions';

interface SalesUser {
  id: string;
  fullName: string;
}

function Banner({ state }: { state: BrokerLeadActionState }) {
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

export function ApproveBrokerLeadForm({
  leadId,
  salesUsers,
}: {
  leadId: string;
  salesUsers: SalesUser[];
}) {
  const [state, formAction] = useActionState<BrokerLeadActionState, FormData>(
    approveBrokerLeadAction.bind(null, leadId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="تعيين مندوب مبيعات" name="assignedSalesId" hint="اختياري">
        <Select id={`assigned-${leadId}`} name="assignedSalesId" defaultValue="">
          <option value="">— لا تعيين الآن —</option>
          {salesUsers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="ملاحظة" name="note" hint="اختياري — ستُحفظ كملاحظة مرتبطة بالفرصة">
        <Textarea id={`approve-note-${leadId}`} name="note" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>اعتماد الفرصة</SubmitButton>
      </div>
    </form>
  );
}

export function RejectBrokerLeadForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useActionState<BrokerLeadActionState, FormData>(
    rejectBrokerLeadAction.bind(null, leadId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="سبب الرفض" name="reason" required>
        <Textarea id={`reject-${leadId}`} name="reason" rows={3} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="danger">رفض</SubmitButton>
      </div>
    </form>
  );
}

export function MarkDuplicateBrokerLeadForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useActionState<BrokerLeadActionState, FormData>(
    markBrokerLeadDuplicateAction.bind(null, leadId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <Field label="ملاحظة على التكرار" name="reason" hint="اختياري">
        <Textarea id={`dup-${leadId}`} name="reason" rows={2} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary">تعليم كمكرر</SubmitButton>
      </div>
    </form>
  );
}
