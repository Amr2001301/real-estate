'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PermissionDeniedState } from '@/components/permission-denied';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
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

function FormField({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
        {required && <span className="text-danger-500 ms-1">*</span>}
      </p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Banner({
  state,
  deniedTitle,
  savedOk,
}: {
  state: BrokerLeadActionState;
  deniedTitle?: string;
  savedOk: string;
}) {
  if (state.error) {
    if (state.missingPermission) {
      return (
        <PermissionDeniedState
          variant="inline"
          permissions={state.permissions ?? []}
          title={deniedTitle}
        />
      );
    }
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

// ── Approve ─────────────────────────────────────────────────────────────────

export function ApproveBrokerLeadForm({
  leadId,
  salesUsers,
  locale = 'ar',
}: {
  leadId: string;
  salesUsers: SalesUser[];
  locale?: Locale;
}) {
  const m = uiT(locale).pages.brokerLeadDetail;
  const [state, formAction] = useActionState<BrokerLeadActionState, FormData>(
    approveBrokerLeadAction.bind(null, leadId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col flex-1 gap-4">
      <Banner state={state} deniedTitle={m.deniedApprove} savedOk={m.savedOk} />
      <FormField label={m.formAssignSalesLabel} hint={m.formDuplicateNoteHint}>
        <Select id={`assigned-${leadId}`} name="assignedSalesId" defaultValue="">
          <option value="">{m.formNoAssignOption}</option>
          {salesUsers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={m.formNoteLabel} hint={m.formNoteHint}>
        <Textarea id={`approve-note-${leadId}`} name="note" rows={3} />
      </FormField>
      <div className="mt-auto pt-4 border-t border-hairline">
        <SubmitButton className="w-full">{m.btnApprove}</SubmitButton>
      </div>
    </form>
  );
}

// ── Reject ──────────────────────────────────────────────────────────────────

export function RejectBrokerLeadForm({
  leadId,
  locale = 'ar',
}: {
  leadId: string;
  locale?: Locale;
}) {
  const m = uiT(locale).pages.brokerLeadDetail;
  const [state, formAction] = useActionState<BrokerLeadActionState, FormData>(
    rejectBrokerLeadAction.bind(null, leadId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col flex-1 gap-4">
      <Banner state={state} deniedTitle={m.deniedReject} savedOk={m.savedOk} />
      <div className="flex flex-col flex-1 gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {m.formRejectReasonLabel} <span className="text-danger-500 ms-1">*</span>
        </p>
        <Textarea
          id={`reject-${leadId}`}
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

// ── Duplicate ────────────────────────────────────────────────────────────────

export function MarkDuplicateBrokerLeadForm({
  leadId,
  locale = 'ar',
}: {
  leadId: string;
  locale?: Locale;
}) {
  const m = uiT(locale).pages.brokerLeadDetail;
  const [state, formAction] = useActionState<BrokerLeadActionState, FormData>(
    markBrokerLeadDuplicateAction.bind(null, leadId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col flex-1 gap-4">
      <Banner state={state} deniedTitle={m.deniedDuplicate} savedOk={m.savedOk} />
      <div className="flex flex-col flex-1 gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {m.formDuplicateNoteLabel}
        </p>
        <p className="text-[11px] text-slate-400 -mt-0.5">{m.formDuplicateNoteHint}</p>
        <Textarea
          id={`dup-${leadId}`}
          name="reason"
          className="flex-1 resize-none"
        />
      </div>
      <div className="pt-4 border-t border-hairline">
        <SubmitButton variant="secondary" className="w-full">{m.btnDuplicate}</SubmitButton>
      </div>
    </form>
  );
}
