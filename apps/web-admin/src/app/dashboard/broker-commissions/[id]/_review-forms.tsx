'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { SubmitButton } from '@/components/form/submit-button';
import { Textarea } from '@/components/ui/textarea';
import {
  approveBrokerCommissionAction,
  rejectBrokerCommissionAction,
  cancelBrokerCommissionAction,
  type BrokerCommissionActionState,
} from '../actions';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
        {required && <span className="text-danger-500 ms-1">*</span>}
      </p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

function Banner({ state, savedOk }: { state: BrokerCommissionActionState; savedOk: string }) {
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

interface FormProps {
  id: string;
  locale?: Locale;
}

export function ApproveCommissionForm({ id, locale = 'ar' }: FormProps) {
  const m = uiT(locale).pages.brokerCommissionDetail;
  const [state, formAction] = useActionState<BrokerCommissionActionState, FormData>(
    approveBrokerCommissionAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col flex-1 gap-4">
      <Banner state={state} savedOk={m.savedOk} />
      <div className="flex flex-col flex-1 gap-1.5">
        <FormField label={m.formNoteLabel} hint={m.formNoteHint}>
          <Textarea
            id={`approve-notes-${id}`}
            name="notes"
            className="flex-1 resize-none"
          />
        </FormField>
      </div>
      <div className="pt-4 border-t border-hairline">
        <SubmitButton className="w-full">{m.btnApprove}</SubmitButton>
      </div>
    </form>
  );
}

export function RejectCommissionForm({ id, locale = 'ar' }: FormProps) {
  const m = uiT(locale).pages.brokerCommissionDetail;
  const [state, formAction] = useActionState<BrokerCommissionActionState, FormData>(
    rejectBrokerCommissionAction.bind(null, id),
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-col flex-1 gap-4"
      onSubmit={(e) => {
        if (!window.confirm(m.confirmReject)) e.preventDefault();
      }}
    >
      <Banner state={state} savedOk={m.savedOk} />
      <div className="flex flex-col flex-1 gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {m.formRejectReasonLabel} <span className="text-danger-500 ms-1">*</span>
        </p>
        <Textarea
          id={`reject-${id}`}
          name="reason"
          required
          className="flex-1 resize-none"
        />
      </div>
      <div className="pt-4 border-t border-hairline">
        <SubmitButton variant="danger" className="w-full">{m.btnReject}</SubmitButton>
      </div>
    </form>
  );
}

export function CancelCommissionForm({ id, locale = 'ar' }: FormProps) {
  const m = uiT(locale).pages.brokerCommissionDetail;
  const [state, formAction] = useActionState<BrokerCommissionActionState, FormData>(
    cancelBrokerCommissionAction.bind(null, id),
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-col flex-1 gap-4"
      onSubmit={(e) => {
        if (!window.confirm(m.confirmCancel)) e.preventDefault();
      }}
    >
      <Banner state={state} savedOk={m.savedOk} />
      <div className="flex flex-col flex-1 gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {m.formCancelReasonLabel} <span className="text-danger-500 ms-1">*</span>
        </p>
        <Textarea
          id={`cancel-${id}`}
          name="reason"
          required
          className="flex-1 resize-none"
        />
      </div>
      <div className="pt-4 border-t border-hairline">
        <SubmitButton variant="secondary" className="w-full">{m.btnCancel}</SubmitButton>
      </div>
    </form>
  );
}
