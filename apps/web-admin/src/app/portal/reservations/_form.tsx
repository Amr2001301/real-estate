'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
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
import { SearchSelect, type SearchOption } from '@/components/form/search-select';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { tx, formatCurrency } from '@/lib/format';
import { findPortalUnit } from '@/lib/portal-units';
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
  /** First few approved leads still waiting for a sales rep (warning only). */
  leadsMissingSales: PortalLead[];
  currency?:         string;
}

const NAV_SECTIONS = [
  { id: 'section-lead-unit', num: '01', label: 'الفرصة والوحدة', sub: 'الفرصة المعتمدة والوحدة' },
  { id: 'section-notes',     num: '02', label: 'ملاحظات',        sub: 'معلومات إضافية' },
];

// Leads and units are searched on the server (SearchSelect): this form used
// to preload ?pageSize=200 of each, so lead or unit 201 could not be reserved.
export default function PortalReservationForm({ leadsMissingSales, currency = 'SAR' }: Props) {
  const [state, formAction] = useActionState<PortalReservationFormState, FormData>(
    createPortalReservationAction,
    {},
  );

  const [selectedLead, setSelectedLead] = useState<PortalLead | null>(null);
  const [unitId, setUnitId] = useState('');
  // The opportunity's own unit, pre-selected when this broker can still book it.
  const [autoUnit, setAutoUnit] = useState<PortalUnit | null>(null);
  const leadRequest = useRef(0);

  // Booking plan options for the selected unit (source of the booking amount).
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [durationOptionId, setDurationOptionId] = useState('');

  const leadId = selectedLead?.id ?? '';
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

  // Once an opportunity is chosen, scope the units to its project. Before
  // that every available unit is searchable, so the field works on its own.
  const unitsEndpoint = `/api-proxy/portal/units?status=AVAILABLE${
    leadProjectId ? `&projectId=${encodeURIComponent(leadProjectId)}` : ''
  }`;

  function toUnitOption(u: PortalUnit): SearchOption<PortalUnit> {
    return {
      id: u.id,
      label: `${u.code} • ${tx(u.building.phase.project.name)} — ${formatCurrency(u.price, currency)}`,
      raw: u,
    };
  }

  function onLeadChange(lead: PortalLead | null) {
    const request = ++leadRequest.current;
    setSelectedLead(lead);
    setAutoUnit(null);
    setUnitId('');
    // Pre-select the opportunity's unit when it is still available to this
    // broker in that project.
    if (!lead) return;
    void findPortalUnit(lead, 'AVAILABLE').then((unit) => {
      if (request !== leadRequest.current) return; // a newer pick won
      setAutoUnit(unit);
      setUnitId(unit?.id ?? '');
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {leadsMissingSales.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 px-5 py-4 text-sm shadow-soft">
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

      <PremiumFormLayout
        navSections={NAV_SECTIONS}
        sidebarBadge="جديد"
        sidebarInfo="الحجز يتطلب فرصة معتمدة ومندوب مبيعات مُعيَّن. سيتم احتساب العمولة كلقطة عند الإنشاء."
      >
        <PremiumFormPanel
          id="section-lead-unit"
          number="01"
          title="الفرصة والوحدة"
          description="الحجز يتطلب فرصة معتمدة + وحدة متاحة + مندوب مبيعات داخلي مُعيَّن على الفرصة."
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الفرصة" name="leadId" required hint="فرص معتمدة فقط">
            <SearchSelect<PortalLead>
              name="leadId"
              required
              endpoint="/api-proxy/portal/leads?brokerApprovalStatus=APPROVED"
              toOption={(l) => ({
                id: l.id,
                label: `${l.fullName} • ${l.phone}${
                  l.assignedSalesId
                    ? l.assignedSales
                      ? ` — مندوب: ${l.assignedSales.fullName}`
                      : ''
                    : ' — (بدون مندوب)'
                }`,
                raw: l,
                // A reservation needs an internal sales rep on the lead.
                disabled: !l.assignedSalesId,
              })}
              onChange={onLeadChange}
              placeholder="ابحث باسم العميل أو رقمه…"
            />
          </Field>
          <Field
            label="الوحدة"
            name="unitId"
            required
            hint={leadProjectId ? 'وحدات متاحة لهذا المشروع' : 'وحدات متاحة فقط'}
          >
            {/* Keyed by lead and auto-pick: either change resets the unit. */}
            <SearchSelect<PortalUnit>
              key={`${leadId}:${autoUnit?.id ?? ''}`}
              name="unitId"
              required
              endpoint={unitsEndpoint}
              toOption={toUnitOption}
              initial={autoUnit ? toUnitOption(autoUnit) : null}
              onChange={(u) => setUnitId(u?.id ?? '')}
              placeholder="ابحث بكود الوحدة…"
            />
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
                          {p.name} — مبلغ الحجز {formatCurrency(p.reservationAmount, currency)}
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
                      {formatCurrency(selectedPlan.reservationAmount, currency)}
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
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-notes"
          number="02"
          title="ملاحظات"
          description="معلومات إضافية لمندوب المبيعات الداخلي."
        >
          <Field label="ملاحظة" name="notes">
            <Textarea id="notes" name="notes" rows={3} />
          </Field>
        </PremiumFormPanel>
      </PremiumFormLayout>

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
