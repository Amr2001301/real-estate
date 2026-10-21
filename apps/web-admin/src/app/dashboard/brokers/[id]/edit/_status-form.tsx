'use client';

import { useActionState, useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react';
import { Field } from '@/components/form/field';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BrokerStatusBadge } from '@/components/badges';
import { PremiumFormPanel } from '@/components/premium';
import type { Broker } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { cn } from '@/lib/cn';
import BrokerForm from '../../_form';
import { setBrokerPayoutHoldAction, updateBrokerStatusAction, type BrokerFormState } from '../../actions';

const STATUS_FORM = 'broker-status-form';

/**
 * The edit page: the broker form with two more steps — 06 status and 07
 * payout hold — in the same layout and step list. Status saves through its
 * own form (fields point at it with the `form` attribute, since forms can't
 * nest); the hold is a toggle with its own action.
 */
export default function BrokerEditForm({ broker, locale = 'ar' }: { broker: Broker; locale?: Locale }) {
  const m = uiT(locale).pages.brokerStatusForm;
  const [state, statusAction, statusPending] = useActionState<BrokerFormState, FormData>(
    updateBrokerStatusAction.bind(null, broker.id),
    {},
  );
  const held = !!broker.payoutHold;
  const [holdError, setHoldError] = useState<string | null>(null);
  const [holdPending, startHold] = useTransition();

  return (
    <>
      <BrokerForm
        broker={broker}
        locale={locale}
        extraNav={[
          { id: 'status', num: '06', label: m.title, sub: m.currentStatusLabel },
          { id: 'payout-hold', num: '07', label: m.holdTitle, sub: held ? m.holdOn : m.holdOff },
        ]}
        extraPanels={
          <>
            <PremiumFormPanel id="status" number="06" title={m.title} description={m.subtitle} className="scroll-mt-24">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-slate-500">{m.currentStatusLabel}</span>
                  <BrokerStatusBadge status={broker.status} locale={locale} />
                </div>
                {state.error && (
                  <div className="flex items-start gap-2 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-600">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">{state.error}</p>
                  </div>
                )}
                {state.ok && (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-500/12 p-3 text-sm text-emerald-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">{m.savedOk}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={m.fieldStatus} name="status" required>
                    <Select id="status" name="status" form={STATUS_FORM} defaultValue={broker.status} required>
                      <option value="PENDING">{m.statusPending}</option>
                      <option value="ACTIVE">{m.statusActive}</option>
                      <option value="SUSPENDED">{m.statusSuspended}</option>
                      <option value="TERMINATED">{m.statusTerminated}</option>
                    </Select>
                  </Field>
                </div>
                <Field label={m.fieldReason} name="reason" hint={m.fieldReasonHint}>
                  <Textarea id="reason" name="reason" form={STATUS_FORM} rows={3} />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" form={STATUS_FORM} variant="primary" size="md" loading={statusPending} disabled={statusPending}>
                    {m.btnUpdate}
                  </Button>
                </div>
              </div>
            </PremiumFormPanel>

            <PremiumFormPanel id="payout-hold" number="07" title={m.holdTitle} description={m.holdOff} className="scroll-mt-24">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full', held ? 'bg-amber-500/12 text-amber-600' : 'bg-emerald-500/12 text-emerald-600')}>
                    {held ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-slate-900">{held ? m.holdOn : m.holdOff}</p>
                    {holdError && <p className="mt-0.5 text-xs text-danger-600">{holdError}</p>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  loading={holdPending}
                  data-testid="broker-payout-hold"
                  onClick={() =>
                    startHold(async () => {
                      setHoldError(null);
                      const res = await setBrokerPayoutHoldAction(broker.id, !held);
                      if (res.error) setHoldError(res.error);
                    })
                  }
                >
                  {held ? m.holdBtnOff : m.holdBtnOn}
                </Button>
              </div>
            </PremiumFormPanel>
          </>
        }
      />
      {/* The status step's own form, outside the broker form; its fields point here. */}
      <form id={STATUS_FORM} action={statusAction} hidden />
    </>
  );
}
