'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Calculator, Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { formatCurrency } from '@/lib/format';
import { currencySymbol } from '@/lib/currency-format';
import type {
  InstallmentPlanTemplate,
  DownPaymentType,
  InstallmentFrequency,
  StartDateRule,
} from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { computeDurationOption } from '@/lib/installment-calc';
import { createPlanAction, updatePlanAction, type PlanFormState } from './actions';

interface DurationOptionState {
  key: string;
  durationMonths: string;
  increasePercentage: string;
}

function newDurationKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

interface UnitOption {
  id: string;
  code: string;
  type: string;
  price: string | number;
}

interface Props {
  projects:     ProjectOption[];
  initialData?: InstallmentPlanTemplate;
  mode:         'create' | 'edit';
  currency?:    string;
  locale?:      Locale;
}

function parseNum(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(val: unknown, fallback = ''): string {
  const n = safeNum(val, NaN);
  return Number.isFinite(n) ? String(n) : fallback;
}


export default function PlanForm({ projects, initialData, mode, currency = 'SAR', locale = 'ar' }: Props) {
  const m = uiT(locale).pages.installmentsForm;
  const symbol = currencySymbol(currency);
  const action =
    mode === 'edit' && initialData
      ? updatePlanAction.bind(null, initialData.id)
      : createPlanAction;

  const [state, formAction] = useActionState<PlanFormState, FormData>(action, {});

  const d = initialData;

  const [projectId, setProjectId] = useState(d?.projectId ?? '');
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitId, setUnitId] = useState(d?.unitId ?? '');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [manualPriceOverride, setManualPriceOverride] = useState(mode === 'edit');
  const [totalPrice, setTotalPrice] = useState(safeStr(d?.totalPrice));
  const [discountType, setDiscountType] = useState<DownPaymentType>(d?.discountType ?? 'FIXED');
  const [discountValue, setDiscountValue] = useState(
    safeStr(d?.discountValue ?? d?.discountAmount, '0'),
  );
  const [reservationAmountType, setReservationAmountType] = useState<DownPaymentType>(
    d?.reservationAmountType ?? 'FIXED',
  );
  const [reservationAmountValue, setReservationAmountValue] = useState(
    safeStr(d?.reservationAmountValue ?? d?.reservationAmount, '0'),
  );
  const [downPaymentType, setDownPaymentType] = useState<DownPaymentType>(
    d?.downPaymentType ?? 'FIXED',
  );
  const [downPaymentValue, setDownPaymentValue] = useState(safeStr(d?.downPaymentValue));
  const [installmentsCount, setInstallmentsCount] = useState(
    d?.installmentsCount != null ? String(d.installmentsCount) : '12',
  );
  const [frequency, setFrequency] = useState<InstallmentFrequency>(d?.frequency ?? 'MONTHLY');
  const [startDateRule, setStartDateRule] = useState<StartDateRule>(
    d?.startDateRule ?? 'AFTER_CONTRACT',
  );
  const [manualStartDate, setManualStartDate] = useState(
    d?.manualStartDate ? d.manualStartDate.slice(0, 10) : '',
  );
  const [finalPaymentAmount, setFinalPaymentAmount] = useState(
    d?.finalPaymentAmount != null ? safeStr(d.finalPaymentAmount) : '',
  );

  const [durationOptions, setDurationOptions] = useState<DurationOptionState[]>(() => {
    if (d?.durationOptions && d.durationOptions.length > 0) {
      return d.durationOptions.map((opt) => ({
        key: newDurationKey(),
        durationMonths: String(opt.durationMonths),
        increasePercentage: safeStr(opt.increasePercentage, '0'),
      }));
    }
    if (mode === 'edit') return [];
    return [{ key: newDurationKey(), durationMonths: '12', increasePercentage: '0' }];
  });

  function addDurationOption() {
    setDurationOptions((opts) => [
      ...opts,
      { key: newDurationKey(), durationMonths: '', increasePercentage: '0' },
    ]);
  }

  function removeDurationOption(key: string) {
    setDurationOptions((opts) => opts.filter((o) => o.key !== key));
  }

  function updateDurationOption(key: string, patch: Partial<Omit<DurationOptionState, 'key'>>) {
    setDurationOptions((opts) =>
      opts.map((o) => (o.key === key ? { ...o, ...patch } : o)),
    );
  }

  const [unitTouched, setUnitTouched] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setUnits([]);
      setUnitId('');
      setUnitPrice(0);
      if (!manualPriceOverride) setTotalPrice('');
      return;
    }
    setUnitsLoading(true);
    const unitsUrl =
      mode === 'create'
        ? `/api-proxy/units?projectId=${projectId}&pageSize=200&withoutPlan=true`
        : `/api-proxy/units?projectId=${projectId}&pageSize=200`;
    fetch(unitsUrl)
      .then((r) => r.json())
      .then((data) => {
        const list: UnitOption[] = (data?.data ?? []).map((u: UnitOption) => ({
          id: u.id,
          code: u.code,
          type: u.type,
          price: u.price,
        }));
        setUnits(list);

        if (d?.unitId) {
          const existing = list.find((u) => u.id === d.unitId);
          if (existing) {
            setUnitPrice(safeNum(existing.price));
          }
        }
      })
      .catch(() => setUnits([]))
      .finally(() => setUnitsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, mode]);

  function handleUnitChange(id: string) {
    setUnitId(id);
    setUnitTouched(true);
    if (!id) {
      setUnitPrice(0);
      if (!manualPriceOverride) setTotalPrice('');
      return;
    }
    const unit = units.find((u) => u.id === id);
    if (unit) {
      const price = safeNum(unit.price);
      setUnitPrice(price);
      if (!manualPriceOverride) {
        setTotalPrice(price > 0 ? String(price) : '');
      }
    }
  }

  function handleManualOverrideChange(checked: boolean) {
    setManualPriceOverride(checked);
    if (!checked && unitPrice > 0) {
      setTotalPrice(String(unitPrice));
    }
  }

  const tp = parseNum(totalPrice);
  const discValue = parseNum(discountValue);
  const disc = discountType === 'PERCENTAGE' ? (tp * discValue) / 100 : discValue;
  const netPrice = tp - disc;
  const reservationValue = parseNum(reservationAmountValue);
  const reservation =
    reservationAmountType === 'PERCENTAGE' ? (netPrice * reservationValue) / 100 : reservationValue;
  const dpVal = parseNum(downPaymentValue);
  const dpAmount = downPaymentType === 'PERCENTAGE' ? (netPrice * dpVal) / 100 : dpVal;

  const unitError = unitTouched && !unitId ? m.unitError : undefined;

  const durationCalcRows = useMemo(() => {
    return durationOptions.map((opt) => {
      const months = parseInt(opt.durationMonths) || 0;
      const pct = parseNum(opt.increasePercentage);
      const calc = computeDurationOption({
        netPrice,
        reservationAmount: reservation,
        downPaymentAmount: dpAmount,
        durationMonths: months,
        increasePercentage: pct,
      });
      return { ...opt, months, pct, ...calc };
    });
  }, [durationOptions, netPrice, reservation, dpAmount]);

  const durationOptionsError = (() => {
    if (durationOptions.length === 0) return null;
    const months = durationCalcRows.map((r) => r.months);
    if (months.some((mo) => mo <= 0)) return m.errorAllDurations;
    const seen = new Set<number>();
    for (const mo of months) {
      if (seen.has(mo)) return m.errorDuplicateDuration(mo);
      seen.add(mo);
    }
    if (durationCalcRows.some((r) => r.pct < 0)) return m.errorIncreaseNeg;
    return null;
  })();

  const reservationPlusDownError =
    netPrice > 0 && reservation + dpAmount > netPrice
      ? m.errorReservationPlusDown
      : null;

  const useDurationModel = durationOptions.length > 0;

  const reservationAmountError =
    useDurationModel && reservation <= 0
      ? m.errorReservationZero
      : null;

  function numericInputProps(
    value: string,
    onChange: (v: string) => void,
    opts?: { allowEmpty?: boolean },
  ) {
    return {
      type: 'text' as const,
      inputMode: 'decimal' as const,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
          onChange(raw);
        }
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        const n = parseFloat(e.target.value);
        if (!opts?.allowEmpty && !Number.isFinite(n)) onChange('0');
        else if (Number.isFinite(n)) onChange(String(n));
      },
    };
  }

  const navSections = useDurationModel
    ? [
        { id: 'section-plan-info',    num: '01', label: m.nav01Title, sub: m.nav01Sub },
        { id: 'section-pricing',      num: '02', label: m.nav02Title, sub: m.nav02Sub },
        { id: 'section-down-payment', num: '03', label: m.nav03Title, sub: m.nav03Sub },
        { id: 'section-durations',    num: '04', label: m.nav04Title, sub: m.nav04Sub },
        { id: 'section-start-date',   num: '05', label: m.nav05Title, sub: m.nav05Sub },
      ]
    : [
        { id: 'section-plan-info',    num: '01', label: m.nav01Title,       sub: m.nav01Sub },
        { id: 'section-pricing',      num: '02', label: m.nav02Title,       sub: m.nav02Sub },
        { id: 'section-down-payment', num: '03', label: m.nav03Title,       sub: m.nav03Sub },
        { id: 'section-durations',    num: '04', label: m.nav04Title,       sub: m.nav04Sub },
        { id: 'section-legacy',       num: '05', label: m.nav05LegacyTitle, sub: m.nav05LegacySub },
        { id: 'section-start-date',   num: '06', label: m.nav06Title,       sub: m.nav06Sub },
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
        sidebarBadge={mode === 'edit' ? m.sidebarBadgeEdit : m.sidebarBadgeNew}
        sidebarInfo={mode === 'edit' ? m.sidebarInfoEdit : m.sidebarInfoNew}
      >
        {/* ── Panel 01: Plan Info ── */}
        <PremiumFormPanel
          id="section-plan-info"
          number="01"
          title={m.p1Title}
          description={m.p1Desc}
        >
          <div className="flex flex-col gap-5">
            <Field label={m.labelName} name="name" required>
              <Input
                id="name"
                name="name"
                required
                defaultValue={d?.name}
                placeholder={m.namePlaceholder}
              />
            </Field>

            <Field label={m.labelDesc} name="description">
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={d?.description ?? ''}
                placeholder={m.descPlaceholder}
              />
            </Field>

            <Field label={m.labelProject} name="projectId" required hint={m.hintProject}>
              <Select
                id="projectId"
                name="projectId"
                required
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setUnitId('');
                  setUnitTouched(false);
                }}
              >
                <option value="">{m.optionChooseProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name.ar}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={m.labelUnit}
              name="unitId"
              required
              error={unitError}
              hint={
                !projectId
                  ? m.unitHintNoProject
                  : unitsLoading
                  ? m.unitHintLoading
                  : units.length === 0 && mode === 'create'
                  ? m.unitHintNoneCreate
                  : units.length === 0
                  ? m.unitHintNoneEdit
                  : undefined
              }
            >
              <Select
                id="unitId"
                name="unitId"
                required
                value={unitId}
                disabled={!projectId || unitsLoading || units.length === 0}
                onChange={(e) => handleUnitChange(e.target.value)}
                invalid={!!unitError}
                onBlur={() => setUnitTouched(true)}
              >
                <option value="">{m.optionChooseUnit}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.type} — {formatCurrency(u.price, currency)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={m.labelStatus} name="status">
                <Select id="status" name="status" defaultValue={d?.status ?? 'DRAFT'}>
                  <option value="DRAFT">{m.statusDraft}</option>
                  <option value="ACTIVE">{m.statusActive}</option>
                  <option value="INACTIVE">{m.statusInactive}</option>
                </Select>
              </Field>
              <Field label={m.labelVisibility} hint={m.hintVisibility}>
                <input type="hidden" name="visibility" value="SALES_ONLY" />
                <div className="h-10 flex items-center rounded-xl border border-hairline bg-canvas/40 px-3 text-sm text-slate-500">
                  {m.visibilityDisplay}
                </div>
              </Field>
            </div>
          </div>
        </PremiumFormPanel>

        {/* ── Panel 02: Pricing ── */}
        <PremiumFormPanel
          id="section-pricing"
          number="02"
          title={m.p2Title}
          description={m.p2Desc}
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="totalPrice" className="text-sm font-medium text-slate-700">
                  {m.totalPriceLabel(symbol)}
                  <span className="text-danger-600 ms-0.5">*</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={manualPriceOverride}
                    onChange={(e) => handleManualOverrideChange(e.target.checked)}
                    className="accent-brand-500 h-3.5 w-3.5"
                  />
                  <span className="text-xs text-slate-600">{m.manualOverrideLabel}</span>
                </label>
              </div>
              <Input
                id="totalPrice"
                name="totalPrice"
                required
                readOnly={!manualPriceOverride}
                className={!manualPriceOverride ? 'bg-canvas/40 text-slate-600 cursor-default' : ''}
                placeholder={m.totalPricePlaceholder}
                {...(manualPriceOverride
                  ? numericInputProps(totalPrice, setTotalPrice, { allowEmpty: false })
                  : { value: totalPrice, onChange: () => {} })}
              />
              <p className="text-xs text-slate-500">{m.totalPriceHint}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-slate-700">{m.discountTypeLabel}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {(['FIXED', 'PERCENTAGE'] as DownPaymentType[]).map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                      discountType === t
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-hairline bg-surface text-muted hover:border-brand-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="discountType"
                      value={t}
                      checked={discountType === t}
                      onChange={() => setDiscountType(t)}
                      className="accent-brand-500"
                    />
                    <span>{t === 'FIXED' ? m.typeFixed : m.typePct}</span>
                  </label>
                ))}
              </div>
            </div>

            <Field
              label={discountType === 'FIXED' ? m.discountLabelFixed(symbol) : m.discountLabelPct}
              name="discountValue"
              hint={discountType === 'PERCENTAGE' ? m.discountHintPct : m.discountHintFixed}
            >
              <Input
                id="discountValue"
                name="discountValue"
                placeholder={discountType === 'PERCENTAGE' ? '10' : '0'}
                {...numericInputProps(discountValue, setDiscountValue, { allowEmpty: true })}
              />
            </Field>

            {disc > 0 && (
              <div className="rounded-xl bg-canvas/40 border border-hairline p-3 text-sm">
                <p className="text-slate-600 font-medium">
                  {discountType === 'PERCENTAGE' ? m.discountDisplayPct : m.discountDisplayFixed}
                </p>
                <p className="text-slate-900 text-lg font-bold mt-0.5">{formatCurrency(disc, currency)}</p>
              </div>
            )}

            <div>
              <span className="text-sm font-medium text-slate-700">{m.reservationTypeLabel}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {(['FIXED', 'PERCENTAGE'] as DownPaymentType[]).map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                      reservationAmountType === t
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-hairline bg-surface text-muted hover:border-brand-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reservationAmountType"
                      value={t}
                      checked={reservationAmountType === t}
                      onChange={() => setReservationAmountType(t)}
                      className="accent-brand-500"
                    />
                    <span>{t === 'FIXED' ? m.typeFixed : m.typePct}</span>
                  </label>
                ))}
              </div>
            </div>

            <Field
              label={reservationAmountType === 'FIXED' ? m.reservationLabelFixed(symbol) : m.reservationLabelPct}
              name="reservationAmountValue"
              required
              hint={reservationAmountType === 'PERCENTAGE' ? m.reservationHintPct : m.reservationHintFixed}
            >
              <Input
                id="reservationAmountValue"
                name="reservationAmountValue"
                placeholder={reservationAmountType === 'PERCENTAGE' ? '10' : ''}
                {...numericInputProps(reservationAmountValue, setReservationAmountValue, { allowEmpty: true })}
              />
            </Field>

            {reservation > 0 && (
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm">
                <p className="text-brand-700 font-medium">
                  {reservationAmountType === 'PERCENTAGE' ? m.reservationDisplayPct : m.reservationDisplayFixed}
                </p>
                <p className="text-brand-900 text-lg font-bold mt-0.5">{formatCurrency(reservation, currency)}</p>
                {reservationAmountType === 'PERCENTAGE' && (
                  <p className="text-brand-700/80 text-xs mt-1">{m.reservationPctNote}</p>
                )}
              </div>
            )}

            {netPrice > 0 && (
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm">
                <p className="text-brand-700 font-medium">{m.netPriceLabel}</p>
                <p className="text-brand-900 text-lg font-bold mt-0.5">{formatCurrency(netPrice, currency)}</p>
              </div>
            )}
          </div>
        </PremiumFormPanel>

        {/* ── Panel 03: Down Payment ── */}
        <PremiumFormPanel
          id="section-down-payment"
          number="03"
          title={m.p3Title}
          description={m.p3Desc}
        >
          <div className="flex flex-col gap-5">
            <div>
              <span className="text-sm font-medium text-slate-700">{m.downPaymentTypeLabel}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {(['FIXED', 'PERCENTAGE'] as DownPaymentType[]).map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                      downPaymentType === t
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-hairline bg-surface text-muted hover:border-brand-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="downPaymentType"
                      value={t}
                      checked={downPaymentType === t}
                      onChange={() => setDownPaymentType(t)}
                      className="accent-brand-500"
                    />
                    <span>{t === 'FIXED' ? m.typeFixed : m.typePct}</span>
                  </label>
                ))}
              </div>
            </div>

            <Field
              label={downPaymentType === 'FIXED' ? m.downPaymentLabelFixed(symbol) : m.downPaymentLabelPct}
              name="downPaymentValue"
              required
            >
              <Input
                id="downPaymentValue"
                name="downPaymentValue"
                placeholder={downPaymentType === 'PERCENTAGE' ? '10' : '0'}
                {...numericInputProps(downPaymentValue, setDownPaymentValue, { allowEmpty: true })}
              />
            </Field>

            {dpAmount > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm">
                <p className="text-amber-700 font-medium">{m.downPaymentDisplay}</p>
                <p className="text-amber-900 text-lg font-bold mt-0.5">{formatCurrency(dpAmount, currency)}</p>
              </div>
            )}
          </div>
        </PremiumFormPanel>

        {/* ── Panel 04: Duration Options ── */}
        <PremiumFormPanel
          id="section-durations"
          number="04"
          title={m.p4Title}
          description={m.p4Desc}
        >
          <div className="flex flex-col gap-4">
            <input
              type="hidden"
              name="durationOptions"
              value={JSON.stringify(
                durationCalcRows.map((r) => ({
                  durationMonths: r.months,
                  increasePercentage: r.pct,
                })),
              )}
            />

            {reservationPlusDownError && (
              <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{reservationPlusDownError}</p>
              </div>
            )}

            {reservationAmountError && (
              <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{reservationAmountError}</p>
              </div>
            )}

            {durationOptionsError && (
              <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{durationOptionsError}</p>
              </div>
            )}

            <div className="rounded-2xl border border-hairline overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas/40 border-b border-hairline">
                  <tr>
                    <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">{m.colDuration}</th>
                    <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">{m.colIncrease}</th>
                    <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">{m.colFinanced}</th>
                    <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">{m.colMonthly}</th>
                    <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">{m.colTotal}</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {durationCalcRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                        {mode === 'edit' ? m.emptyLegacyEdit : m.emptyCreate}
                      </td>
                    </tr>
                  ) : (
                    durationCalcRows.map((row) => (
                      <tr key={row.key} className="hover:bg-canvas/40 transition-colors">
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="12"
                            value={row.durationMonths}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '' || /^[0-9]+$/.test(v))
                                updateDurationOption(row.key, { durationMonths: v });
                            }}
                            className="max-w-24"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={row.increasePercentage}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v))
                                updateDurationOption(row.key, { increasePercentage: v });
                            }}
                            className="max-w-28"
                          />
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums text-slate-700">
                          {row.months > 0 && netPrice > 0
                            ? formatCurrency(row.financedAmount, currency)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums font-medium">
                          {row.months > 0 && netPrice > 0
                            ? formatCurrency(row.monthlyInstallment, currency)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums text-slate-700">
                          {row.months > 0 && netPrice > 0
                            ? formatCurrency(row.totalPayable, currency)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            onClick={() => removeDurationOption(row.key)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600 transition"
                            aria-label={m.removeDurationAriaLabel}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDurationOption}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {m.addDurationBtn}
              </Button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {m.durationFormulaNote}{' '}
              <span className="font-mono" dir="ltr">
                financed = remaining × (1 + %); monthly = financed / months
              </span>
            </p>
          </div>
        </PremiumFormPanel>

        {/* ── Panel 05: Legacy (only when no duration options) ── */}
        {!useDurationModel && (
          <PremiumFormPanel
            id="section-legacy"
            number="05"
            title={m.p5LegacyTitle}
            description={m.p5LegacyDesc}
          >
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label={m.labelInstallmentsCount} name="installmentsCount">
                  <Input
                    id="installmentsCount"
                    name="installmentsCount"
                    placeholder="12"
                    {...numericInputProps(installmentsCount, (v) => {
                      if (v === '' || /^[0-9]+$/.test(v)) setInstallmentsCount(v);
                    })}
                  />
                </Field>
                <Field label={m.labelFrequency} name="frequency">
                  <Select
                    id="frequency"
                    name="frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as InstallmentFrequency)}
                  >
                    <option value="MONTHLY">{m.freqMonthly}</option>
                    <option value="QUARTERLY">{m.freqQuarterly}</option>
                    <option value="SEMI_ANNUAL">{m.freqSemiAnnual}</option>
                    <option value="YEARLY">{m.freqYearly}</option>
                  </Select>
                </Field>
              </div>

              <Field
                label={m.finalPaymentLabel(symbol)}
                name="finalPaymentAmount"
                hint={m.finalPaymentHint}
              >
                <Input
                  id="finalPaymentAmount"
                  name="finalPaymentAmount"
                  placeholder="0"
                  {...numericInputProps(finalPaymentAmount, setFinalPaymentAmount, { allowEmpty: true })}
                />
              </Field>
            </div>
          </PremiumFormPanel>
        )}

        {/* ── Panel 05/06: Start Date ── */}
        <PremiumFormPanel
          id="section-start-date"
          number={useDurationModel ? '05' : '06'}
          title={m.p6Title}
          description={m.p6Desc}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(['MANUAL', 'AFTER_RESERVATION', 'AFTER_CONTRACT'] as StartDateRule[]).map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition ${
                    startDateRule === r
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-hairline bg-surface text-muted hover:border-brand-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="startDateRule"
                    value={r}
                    checked={startDateRule === r}
                    onChange={() => setStartDateRule(r)}
                    className="accent-brand-500"
                  />
                  <span>
                    {r === 'MANUAL'
                      ? m.startManual
                      : r === 'AFTER_RESERVATION'
                        ? m.startAfterReservation
                        : m.startAfterContract}
                  </span>
                </label>
              ))}
            </div>

            {startDateRule === 'MANUAL' && (
              <Field label={m.labelManualStartDate} name="manualStartDate" required>
                <Input
                  id="manualStartDate"
                  name="manualStartDate"
                  type="date"
                  required
                  value={manualStartDate}
                  onChange={(e) => setManualStartDate(e.target.value)}
                />
              </Field>
            )}
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      {/* ── Net price summary ── */}
      {netPrice > 0 && (
        <section className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm">
          <Calculator className="h-4 w-4 text-brand-600" />
          <span className="text-slate-500">{m.summaryNetPrice}</span>
          <span className="font-bold text-slate-900">{formatCurrency(netPrice, currency)}</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="text-slate-500">{m.summaryRemaining}</span>
          <span className="font-bold text-slate-900">
            {formatCurrency(Math.max(0, netPrice - reservation - dpAmount), currency)}
          </span>
        </section>
      )}

      <FormFooter
        sticky
        primary={
          <SubmitButton pendingLabel={m.submitPending}>
            {mode === 'create' ? m.submitCreate : m.submitEdit}
          </SubmitButton>
        }
        secondary={
          <Link href="/dashboard/installments">
            <Button variant="ghost" size="md" type="button">
              {m.cancelBtn}
            </Button>
          </Link>
        }
      />
    </form>
  );
}
