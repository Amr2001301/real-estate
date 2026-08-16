'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BrokerStatusBadge } from '@/components/badges';
import type { Broker } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { updateBrokerStatusAction, type BrokerFormState } from '../../actions';

interface Props {
  broker: Broker;
  locale?: Locale;
}

export default function BrokerStatusForm({ broker, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.brokerStatusForm;
  const action = updateBrokerStatusAction.bind(null, broker.id);
  const [state, formAction] = useActionState<BrokerFormState, FormData>(action, {});

  return (
    <div className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]">
      <div className="flex items-center justify-between gap-4 border-b border-hairline bg-surface-muted/20 px-7 sm:px-8 py-5">
        <div>
          <p className="text-[14px] font-bold text-navy leading-tight">{m.title}</p>
          <p className="text-[12px] text-slate-400 mt-0.5 leading-tight">
            {m.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">{m.currentStatusLabel}</span>
          <BrokerStatusBadge status={broker.status} />
        </div>
      </div>

      <div className="px-7 sm:px-8 py-7">
        <form action={formAction} className="flex flex-col gap-4">
          {state.error && (
            <div className="flex items-start gap-3 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{state.error}</p>
            </div>
          )}
          {state.ok && (
            <div className="flex items-start gap-3 rounded-xl bg-success-50 border border-success-100 text-success-700 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{m.savedOk}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.fieldStatus} name="status" required>
              <Select id="status" name="status" defaultValue={broker.status} required>
                <option value="PENDING">{m.statusPending}</option>
                <option value="ACTIVE">{m.statusActive}</option>
                <option value="SUSPENDED">{m.statusSuspended}</option>
                <option value="TERMINATED">{m.statusTerminated}</option>
              </Select>
            </Field>
          </div>
          <Field label={m.fieldReason} name="reason" hint={m.fieldReasonHint}>
            <Textarea id="reason" name="reason" rows={3} />
          </Field>

          <div className="flex justify-end">
            <SubmitButton>{m.btnUpdate}</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
