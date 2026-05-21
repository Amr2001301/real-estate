'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import {
  AlertCircle,
  X,
  User,
  Phone,
  Building2,
  Home,
  UserCog,
  Wallet,
  Loader2,
} from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { tx, formatCurrency } from '@/lib/format';
import { getUnitProjectId } from '@/lib/portal-units';
import type { PortalLead, PortalUnit } from '@/lib/types';
import {
  createPortalReservationAction,
  type PortalReservationFormState,
} from './actions';

interface PlanOption {
  id: string;
  name: string;
  reservationAmount: string;
  downPaymentAmount: string;
  durationOptions: Array<{
    id: string;
    durationMonths: number;
    increasePercentage: string;
  }>;
}

interface Props {
  approvedLeads: PortalLead[];
  units: PortalUnit[];
}

export default function PortalReservationForm({ approvedLeads, units }: Props) {
  const [state, formAction] = useActionState<PortalReservationFormState, FormData>(
    createPortalReservationAction,
    {},
  );

  const [leadId, setLeadId] = useState('');
  const [unitId, setUnitId] = useState('');

  // Booking plan options for the selected unit (source of the booking amount).
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [durationOptionId, setDurationOptionId] = useState('');

  const selectedLead = approvedLeads.find((l) => l.id === leadId) ?? null;
  const leadProjectId = selectedLead?.projectInterestId ?? '';

  // Fetch applicable booking plans whenever the chosen unit changes.
  useEffect(() => {
    if (!unitId) {
      setPlans([]);
      setPlanId('');
      setDurationOptionId('');
      setPlansError(null);
      return;
    }
    let cancelled = false;
    setPlansLoading(true);
    setPlansError(null);
    fetch(`/api/portal/plan-options?unitId=${unitId}`)
      .then((res) => res.json())
      .then((body: { data?: PlanOption[]; error?: string }) => {
        if (cancelled) return;
        if (body.error) {
          setPlans([]);
          setPlanId('');
          setPlansError('تعذّر تحميل خطط الدفع. حاول مرة أخرى.');
          return;
        }
        const list = body.data ?? [];
        setPlans(list);
        // Auto-select when there is exactly one applicable plan.
        setPlanId(list.length === 1 ? list[0]!.id : '');
        setDurationOptionId('');
      })
      .catch(() => {
        if (cancelled) return;
        setPlans([]);
        setPlanId('');
        setPlansError('تعذّر تحميل خطط الدفع. حاول مرة أخرى.');
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const needsDuration = (selectedPlan?.durationOptions.length ?? 0) > 0;
  const noPlans = unitId !== '' && !plansLoading && !plansError && plans.length === 0;

  // Submit is blocked until a valid booking plan (and duration when required)
  // is resolved — the reservation cannot exist without a booking amount.
  const canSubmit =
    leadId !== '' &&
    unitId !== '' &&
    planId !== '' &&
    (!needsDuration || durationOptionId !== '');

  // Once an opportunity is chosen, scope the unit list to that opportunity's
  // project. Before selection we show all available units so the field isn't
  // empty if the broker explores the list first.
  const visibleUnits = leadProjectId
    ? units.filter((u) => getUnitProjectId(u) === leadProjectId)
    : units;
  const noUnitsForProject = selectedLead !== null && visibleUnits.length === 0;

  function onLeadChange(nextLeadId: string) {
    setLeadId(nextLeadId);
    const lead = approvedLeads.find((l) => l.id === nextLeadId) ?? null;
    const projId = lead?.projectInterestId ?? '';
    // Auto-select the opportunity's unit when it's available to this broker
    // for that project; otherwise leave the unit unselected.
    const leadUnitId = lead?.unitInterestId ?? '';
    const leadUnitAvailable =
      leadUnitId !== '' &&
      units.some((u) => u.id === leadUnitId && getUnitProjectId(u) === projId);
    setUnitId(leadUnitAvailable ? leadUnitId : '');
  }

  // Leads with no assigned sales handler can't proceed — flag them so the
  // broker doesn't waste effort.
  const leadsMissingSales = approvedLeads.filter((l) => !l.assignedSalesId);

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {leadsMissingSales.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              بعض الفرص المعتمدة لا يوجد بها مندوب مبيعات داخلي بعد:
            </p>
            <ul className="mt-1 list-disc ps-5 space-y-0.5 text-xs">
              {leadsMissingSales.slice(0, 5).map((l) => (
                <li key={l.id}>
                  {l.fullName} — {l.phone}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs">
              تواصل مع الإدارة لتعيين مندوب قبل إنشاء الحجز.
            </p>
          </div>
        </div>
      )}

      <FormSection
        title="الفرصة والوحدة"
        description="الحجز يتطلب فرصة معتمدة + وحدة متاحة + مندوب مبيعات داخلي مُعيَّن على الفرصة."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الفرصة" name="leadId" required hint="فرص معتمدة فقط">
            <Select
              id="leadId"
              name="leadId"
              required
              value={leadId}
              onChange={(e) => onLeadChange(e.target.value)}
            >
              <option value="" disabled>
                اختر فرصة
              </option>
              {approvedLeads.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                  disabled={!l.assignedSalesId}
                >
                  {l.fullName} • {l.phone}
                  {l.assignedSalesId
                    ? l.assignedSales
                      ? ` — مندوب: ${l.assignedSales.fullName}`
                      : ''
                    : ' — (بدون مندوب)'}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="الوحدة"
            name="unitId"
            required
            hint={leadProjectId ? 'وحدات متاحة لهذا المشروع' : 'وحدات متاحة فقط'}
          >
            <Select
              id="unitId"
              name="unitId"
              required
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="" disabled>
                اختر وحدة
              </option>
              {noUnitsForProject ? (
                <option value="" disabled>
                  لا توجد وحدات متاحة لهذا المشروع
                </option>
              ) : (
                visibleUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} • {tx(u.building.phase.project.name)} —{' '}
                    {formatCurrency(u.price)}
                  </option>
                ))
              )}
            </Select>
          </Field>
        </div>

        {selectedLead && (
          <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-xs font-semibold text-brand-700 mb-2">
              ملخص الفرصة المختارة
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-slate-700">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                {selectedLead.fullName}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700" dir="ltr">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                {selectedLead.phone}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700">
                <UserCog className="h-4 w-4 text-slate-400 shrink-0" />
                {selectedLead.assignedSales?.fullName ?? '— بدون مندوب —'}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                {selectedLead.projectInterest
                  ? tx(selectedLead.projectInterest.name)
                  : '— بدون مشروع —'}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700" dir="ltr">
                <Home className="h-4 w-4 text-slate-400 shrink-0" />
                {selectedLead.unitInterest?.code ?? '— بدون وحدة —'}
              </span>
            </div>
          </div>
        )}

        {/* Booking plan / amount — derived from admin-controlled active plans.
            The broker never types the amount; it comes from the plan. */}
        {unitId && (
          <div className="mt-3 rounded-2xl border border-hairline bg-surface-muted/40 p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2 inline-flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-600" />
              خطة الدفع ومبلغ الحجز
            </p>

            {plansLoading && (
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ تحميل خطط الدفع…
              </p>
            )}

            {plansError && !plansLoading && (
              <p className="text-sm text-danger-700">{plansError}</p>
            )}

            {noPlans && (
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  لا توجد خطة دفع فعّالة لهذه الوحدة. تواصل مع الإدارة قبل إنشاء
                  الحجز.
                </p>
              </div>
            )}

            {!plansLoading && !plansError && plans.length > 0 && (
              <div className="flex flex-col gap-3">
                {plans.length > 1 ? (
                  <Field label="خطة الدفع" name="planChoice" required hint="اختر خطة">
                    <Select
                      id="planChoice"
                      value={planId}
                      onChange={(e) => {
                        setPlanId(e.target.value);
                        setDurationOptionId('');
                      }}
                    >
                      <option value="" disabled>
                        اختر خطة دفع
                      </option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — مبلغ الحجز {formatCurrency(p.reservationAmount)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <p className="text-sm text-slate-700">
                    الخطة: <span className="font-medium">{plans[0]!.name}</span>
                  </p>
                )}

                {selectedPlan && (
                  <div className="flex items-center justify-between rounded-xl bg-white ring-1 ring-inset ring-hairline px-4 py-3">
                    <span className="text-sm text-slate-600">مبلغ الحجز المطلوب</span>
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      {formatCurrency(selectedPlan.reservationAmount)}
                    </span>
                  </div>
                )}

                {needsDuration && selectedPlan && (
                  <Field
                    label="مدة التقسيط"
                    name="durationChoice"
                    required
                    hint="مطلوبة لهذه الخطة"
                  >
                    <Select
                      id="durationChoice"
                      value={durationOptionId}
                      onChange={(e) => setDurationOptionId(e.target.value)}
                    >
                      <option value="" disabled>
                        اختر مدة التقسيط
                      </option>
                      {selectedPlan.durationOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.durationMonths} شهر
                          {Number(o.increasePercentage) > 0
                            ? ` (+${o.increasePercentage}%)`
                            : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            )}

            {/* Server reads these — the booking amount is derived server-side
                from installmentPlanTemplateId, never trusted from the client. */}
            <input type="hidden" name="installmentPlanTemplateId" value={planId} />
            <input
              type="hidden"
              name="selectedDurationOptionId"
              value={durationOptionId}
            />
          </div>
        )}
      </FormSection>

      <FormSection title="ملاحظات" description="معلومات إضافية لمندوب المبيعات الداخلي.">
        <Field label="ملاحظة" name="notes">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/reservations">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton disabled={!canSubmit}>إنشاء الحجز</SubmitButton>
          </>
        }
        helper="سيتم احتساب نسبة العمولة وحفظها كلقطة (snapshot) عند الإنشاء."
      />
    </form>
  );
}
