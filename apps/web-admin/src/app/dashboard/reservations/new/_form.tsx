'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { LeadStage } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { computeDurationOption } from '@/lib/installment-calc';
import { createReservationAction, type ReservationFormState } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';

interface Unit {
  id: string;
  code: string;
  type: string;
  price?: string | number;
  building?: {
    phase?: { projectId?: string; project?: { id: string; name: { ar: string; en: string } } };
  };
}

interface DurationOption {
  id: string;
  durationMonths: number;
  increasePercentage: string | number;
}

interface PlanOption {
  id: string;
  name: string;
  netPrice?: string | number;
  reservationAmount: string | number;
  downPaymentAmount?: string | number;
  durationOptions: DurationOption[];
  projectId: string;
  unitId: string | null;
}

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  stage: LeadStage;
  projectInterest?: { id: string; name: { ar: string; en: string } } | null;
}

interface Client {
  id: string;
  fullName: string;
  phone: string | null;
  role: 'CLIENT' | 'CUSTOMER';
}

interface SalesUser {
  id: string;
  fullName: string;
  role?: string;
}

interface Props {
  units: Unit[];
  leads: Lead[];
  clients: Client[];
  salesOptions: SalesUser[];
  plans: PlanOption[];
  locale?: Locale;
}

function toFiniteOrEmpty(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? String(n) : '';
}

export default function NewReservationForm({
  units,
  leads,
  clients,
  salesOptions,
  plans,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.reservationsForm;

  const STAGE_LABELS: Record<LeadStage, string> = {
    NEW: m.stageNew, INTERESTED: m.stageInterested, VISIT: m.stageVisit,
    NEGOTIATION: m.stageNegotiation, WON: m.stageWon, LOST: m.stageLost,
  };
  const ROLE_LABELS: Record<'CLIENT' | 'CUSTOMER', string> = {
    CLIENT: m.roleClient, CUSTOMER: m.roleCustomer,
  };
  function formatLeadLabel(l: Lead): string {
    const project = l.projectInterest?.name.ar ?? m.noProject;
    const stage = STAGE_LABELS[l.stage] ?? l.stage;
    return `${l.fullName} — ${project} — ${stage} — ${l.phone}`;
  }
  function formatClientLabel(c: Client): string {
    const role = ROLE_LABELS[c.role];
    const phone = c.phone ?? m.noPhone;
    return `${c.fullName} — ${role} — ${phone}`;
  }

  const [state, formAction] = useActionState<ReservationFormState, FormData>(
    createReservationAction,
    {},
  );
  const [ownerType, setOwnerType] = useState<'lead' | 'client'>('lead');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedDurationOptionId, setSelectedDurationOptionId] = useState('');
  const [bookingAmountMode, setBookingAmountMode] = useState<'PLAN' | 'FIXED' | 'PERCENTAGE'>('PLAN');
  const [fixedAmountInput, setFixedAmountInput] = useState('');
  const [percentInput, setPercentInput] = useState('');

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [selectedUnitId, units],
  );
  const selectedProjectId =
    selectedUnit?.building?.phase?.projectId ?? selectedUnit?.building?.phase?.project?.id ?? '';

  const availablePlans = useMemo(() => {
    if (!selectedUnitId || !selectedProjectId) return [] as PlanOption[];
    return plans.filter(
      (p) =>
        p.projectId === selectedProjectId &&
        (p.unitId === null || p.unitId === selectedUnitId),
    );
  }, [plans, selectedUnitId, selectedProjectId]);

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedUnitId(e.target.value);
    setSelectedPlanId('');
    setSelectedDurationOptionId('');
  }

  function handlePlanChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPlanId(e.target.value);
    setSelectedDurationOptionId('');
  }

  const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId) ?? null;
  const requiredBookingAmount = selectedPlan
    ? toFiniteOrEmpty(selectedPlan.reservationAmount)
    : '';
  const selectedPlanHasBookingAmount =
    !!selectedPlan && Number(selectedPlan.reservationAmount) > 0;
  const selectedPlanInvalid = !!selectedPlan && !selectedPlanHasBookingAmount;
  const planHasDurations =
    !!selectedPlan && selectedPlan.durationOptions.length > 0;
  const selectedDuration = selectedPlan?.durationOptions.find(
    (o) => o.id === selectedDurationOptionId,
  ) ?? null;
  const durationMissing = planHasDurations && !selectedDuration;

  const selectedUnitPrice = useMemo(() => {
    if (!selectedUnit?.price) return 0;
    const n = Number(selectedUnit.price);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [selectedUnit]);
  const percentPreviewAmount = useMemo(() => {
    if (bookingAmountMode !== 'PERCENTAGE') return null;
    const p = Number(percentInput);
    if (!Number.isFinite(p) || p <= 0 || p > 100) return null;
    if (selectedUnitPrice <= 0) return null;
    return Math.round(selectedUnitPrice * (p / 100) * 100) / 100;
  }, [bookingAmountMode, percentInput, selectedUnitPrice]);

  const previewSnapshot = useMemo(() => {
    if (!selectedPlan || !selectedDuration) return null;
    const netPrice = Number(selectedPlan.netPrice ?? selectedPlan.reservationAmount);
    return computeDurationOption({
      netPrice,
      reservationAmount: Number(selectedPlan.reservationAmount),
      downPaymentAmount: Number(selectedPlan.downPaymentAmount ?? 0),
      durationMonths: selectedDuration.durationMonths,
      increasePercentage: Number(selectedDuration.increasePercentage),
    });
  }, [selectedPlan, selectedDuration]);

  const navSections = [
    { id: 'section-unit',    num: '01', label: m.nav01Label, sub: m.nav01Sub },
    { id: 'section-client',  num: '02', label: m.nav02Label, sub: m.nav02Sub },
    { id: 'section-details', num: '03', label: m.nav03Label, sub: m.nav03Sub },
    { id: 'section-plan',    num: '04', label: m.nav04Label, sub: m.nav04Sub },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        navSections={navSections}
        sidebarBadge={m.sidebarBadge}
        sidebarInfo={m.sidebarInfo}
      >
        {/* ── Section 01: Unit ── */}
        <PremiumFormPanel
          id="section-unit"
          number="01"
          title={m.p1Title}
          description={m.p1Desc}
        >
          <Field label={m.unitLabel} name="unitId" required>
            <Select name="unitId" required value={selectedUnitId} onChange={handleUnitChange}>
              <option value="">{m.unitOptionEmpty}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.type}
                  {u.building?.phase?.project?.name.ar
                    ? ` (${u.building.phase.project.name.ar})`
                    : ''}
                </option>
              ))}
            </Select>
          </Field>
        </PremiumFormPanel>

        {/* ── Section 02: Client ── */}
        <PremiumFormPanel
          id="section-client"
          number="02"
          title={m.p2Title}
          description={m.p2Desc}
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{m.ownerTypeLabel}</span>
              <div className="flex flex-wrap gap-3">
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                    ownerType === 'lead'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-hairline bg-surface text-muted hover:border-brand-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="ownerType"
                    value="lead"
                    checked={ownerType === 'lead'}
                    onChange={() => setOwnerType('lead')}
                    className="accent-brand-500"
                  />
                  <span>{m.ownerLead}</span>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                    ownerType === 'client'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-hairline bg-surface text-muted hover:border-brand-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="ownerType"
                    value="client"
                    checked={ownerType === 'client'}
                    onChange={() => setOwnerType('client')}
                    className="accent-brand-500"
                  />
                  <span>{m.ownerClient}</span>
                </label>
              </div>
            </div>

            {ownerType === 'lead' ? (
              <Field
                label={m.leadFieldLabel}
                name="leadId"
                hint={m.leadFieldHint}
                required
              >
                <Select name="leadId" required>
                  <option value="">{m.leadOptionEmpty}</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formatLeadLabel(l)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field
                label={m.clientFieldLabel}
                name="clientId"
                hint={m.clientFieldHint}
                required
              >
                <Select name="clientId" required>
                  <option value="">{m.clientOptionEmpty}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatClientLabel(c)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </PremiumFormPanel>

        {/* ── Section 03: Details ── */}
        <PremiumFormPanel
          id="section-details"
          number="03"
          title={m.p3Title}
          description={m.p3Desc}
        >
          <div className="flex flex-col gap-5">
            <Field label={m.salesLabel} name="salesId">
              <Select name="salesId">
                <option value="">{m.salesOptionEmpty}</option>
                {salesOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {salesActorLabel(s)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={m.expiryLabel}
              name="expiresInHours"
              hint={m.expiryHint}
            >
              <Select name="expiresInHours" defaultValue="72">
                <option value="24">{m.expiry24}</option>
                <option value="48">{m.expiry48}</option>
                <option value="72">{m.expiry72}</option>
                <option value="120">{m.expiry120}</option>
                <option value="168">{m.expiry168}</option>
                <option value="336">{m.expiry336}</option>
              </Select>
            </Field>

            <Field label={m.notesLabel} name="notes" hint={m.notesHint}>
              <Textarea name="notes" rows={3} placeholder={m.notesPlaceholder} />
            </Field>
          </div>
        </PremiumFormPanel>

        {/* ── Section 04: Plan & Booking Amount ── */}
        <PremiumFormPanel
          id="section-plan"
          number="04"
          title={m.p4Title}
          description={m.p4Desc}
        >
          <div className="flex flex-col gap-5">
            <Field
              label={m.planLabel}
              name="installmentPlanTemplateId"
              hint={
                !selectedUnitId
                  ? m.planHintNoUnit
                  : availablePlans.length === 0
                    ? m.planHintNone
                    : m.planHintAvailable
              }
            >
              <Select
                name="installmentPlanTemplateId"
                value={selectedPlanId}
                onChange={handlePlanChange}
                disabled={!selectedUnitId || availablePlans.length === 0}
              >
                <option value="">{m.planOptionNone}</option>
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {m.planOptionReservation} {p.reservationAmount}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedPlanInvalid && (
              <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{m.planInvalidTitle}</p>
                  <p className="text-xs mt-1">{m.planInvalidDetail}</p>
                </div>
              </div>
            )}

            {selectedPlan && (
              <div className="rounded-2xl border border-hairline bg-surface p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">{m.planDetailsTitle}</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">{m.planRequiredBooking}</dt>
                    <dd
                      className={
                        selectedPlanHasBookingAmount
                          ? 'font-bold tabular-nums text-brand-700'
                          : 'font-bold tabular-nums text-danger-700'
                      }
                    >
                      {requiredBookingAmount || '0'}
                    </dd>
                  </div>
                  {selectedPlan.downPaymentAmount !== undefined && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">{m.planDownPayment}</dt>
                      <dd className="font-medium tabular-nums">
                        {toFiniteOrEmpty(selectedPlan.downPaymentAmount) || '0'}
                      </dd>
                    </div>
                  )}
                  {selectedPlan.durationOptions.length > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">{m.planDurationCount}</dt>
                      <dd className="font-medium tabular-nums">
                        {selectedPlan.durationOptions.length}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between sm:col-span-2 border-t border-hairline pt-2 mt-1">
                    <dt className="text-slate-500">{m.planPaymentStatus}</dt>
                    <dd className="font-medium text-amber-700">{m.planPaymentStatusValue}</dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-400 leading-relaxed">{m.planNote}</p>
              </div>
            )}

            <div className="rounded-2xl border border-hairline bg-surface p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{m.bookingAmountTitle}</h3>
                <p className="text-xs text-slate-500 mt-1">{m.bookingAmountDesc}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="bookingAmountModeRadio"
                    value="PLAN"
                    checked={bookingAmountMode === 'PLAN'}
                    onChange={() => setBookingAmountMode('PLAN')}
                  />
                  <span>{m.bookingModePlan}</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="bookingAmountModeRadio"
                    value="FIXED"
                    checked={bookingAmountMode === 'FIXED'}
                    onChange={() => setBookingAmountMode('FIXED')}
                  />
                  <span>{m.bookingModeFixed}</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="bookingAmountModeRadio"
                    value="PERCENTAGE"
                    checked={bookingAmountMode === 'PERCENTAGE'}
                    onChange={() => setBookingAmountMode('PERCENTAGE')}
                  />
                  <span>{m.bookingModePct}</span>
                </label>
              </div>
              {(bookingAmountMode === 'FIXED' || bookingAmountMode === 'PERCENTAGE') && (
                <input type="hidden" name="bookingAmountMode" value={bookingAmountMode} />
              )}

              {bookingAmountMode === 'FIXED' && (
                <Field
                  label={m.fixedLabel}
                  name="bookingAmount"
                  hint={m.fixedHint}
                  required
                >
                  <input
                    type="number"
                    name="bookingAmount"
                    min="1"
                    step="0.01"
                    value={fixedAmountInput}
                    onChange={(e) => setFixedAmountInput(e.target.value)}
                    className="block w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                    placeholder={m.fixedPlaceholder}
                    required
                  />
                </Field>
              )}

              {bookingAmountMode === 'PERCENTAGE' && (
                <>
                  <Field
                    label={m.pctLabel}
                    name="bookingAmountPercent"
                    hint={m.pctHint}
                    required
                  >
                    <input
                      type="number"
                      name="bookingAmountPercent"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={percentInput}
                      onChange={(e) => setPercentInput(e.target.value)}
                      className="block w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                      placeholder={m.pctPlaceholder}
                      required
                    />
                  </Field>
                  <div className="rounded-xl bg-slate-50 border border-hairline p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{m.unitPriceLabel}</span>
                      <span className="font-medium tabular-nums">
                        {selectedUnitPrice > 0 ? selectedUnitPrice.toLocaleString('ar') : m.unitPriceUnset}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{m.calcAmountLabel}</span>
                      <span className="font-bold tabular-nums text-brand-700">
                        {percentPreviewAmount != null
                          ? percentPreviewAmount.toLocaleString('ar')
                          : '—'}
                      </span>
                    </div>
                    {selectedUnitPrice <= 0 && (
                      <p className="text-xs text-danger-700 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {m.unitNoPriceError}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {planHasDurations && (
              <>
                <input
                  type="hidden"
                  name="installmentPlanDurationOptionId"
                  value={selectedDurationOptionId}
                />
                <Field
                  label={m.durationFieldLabel}
                  name="installmentPlanDurationOptionSelect"
                  required
                  hint={m.durationHint}
                >
                  <Select
                    name="installmentPlanDurationOptionSelect"
                    value={selectedDurationOptionId}
                    onChange={(e) => setSelectedDurationOptionId(e.target.value)}
                    required
                  >
                    <option value="">{m.durationOptionEmpty}</option>
                    {selectedPlan!.durationOptions
                      .slice()
                      .sort((a, b) => a.durationMonths - b.durationMonths)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {m.durationOptionLabel(o.durationMonths, Number(o.increasePercentage))}
                        </option>
                      ))}
                  </Select>
                </Field>

                {durationMissing && (
                  <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{m.durationMissingError}</p>
                  </div>
                )}

                {selectedDuration && previewSnapshot && (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">{m.snapshotTitle}</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">{m.snapshotDuration}</dt>
                        <dd className="font-medium tabular-nums">
                          {selectedDuration.durationMonths} {m.snapshotMonthSuffix}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">{m.snapshotIncrease}</dt>
                        <dd className="font-medium tabular-nums">
                          {Number(selectedDuration.increasePercentage)}%
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">{m.snapshotRemaining}</dt>
                        <dd className="font-medium tabular-nums">
                          {previewSnapshot.remainingAmount.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">{m.snapshotFinanced}</dt>
                        <dd className="font-medium tabular-nums">
                          {previewSnapshot.financedAmount.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between sm:col-span-2 border-t border-hairline pt-2 mt-1">
                        <dt className="text-slate-700 font-medium">{m.snapshotMonthly}</dt>
                        <dd className="font-bold tabular-nums text-brand-700 text-base">
                          {previewSnapshot.monthlyInstallment.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between sm:col-span-2">
                        <dt className="text-slate-700 font-medium">{m.snapshotTotal}</dt>
                        <dd className="font-bold tabular-nums">
                          {previewSnapshot.totalPayable.toFixed(2)}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs text-slate-400 leading-relaxed">{m.snapshotNote}</p>
                  </div>
                )}
              </>
            )}

            <Field label={m.bookingNotesLabel} name="bookingNotes">
              <Textarea name="bookingNotes" rows={2} placeholder={m.bookingNotesPlaceholder} />
            </Field>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          selectedPlanInvalid || durationMissing ? (
            <Button type="button" variant="primary" size="md" disabled>
              {m.submitCreate}
            </Button>
          ) : (
            <SubmitButton>{m.submitCreate}</SubmitButton>
          )
        }
        secondary={
          <Link href={'/dashboard/reservations' as never}>
            <Button variant="ghost" size="md" type="button">
              {m.cancelBtn}
            </Button>
          </Link>
        }
      />
    </form>
  );
}
