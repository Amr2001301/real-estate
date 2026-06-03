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
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { formatCurrency } from '@/lib/format';
import type {
  InstallmentPlanTemplate,
  DownPaymentType,
  InstallmentFrequency,
  StartDateRule,
} from '@/lib/types';
import { computeDurationOption } from '@/lib/installment-calc';
import { createPlanAction, updatePlanAction, type PlanFormState } from './actions';

interface DurationOptionState {
  // local id for React keys; not sent to server
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
  projects: ProjectOption[];
  initialData?: InstallmentPlanTemplate;
  mode: 'create' | 'edit';
}

function parseNum(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Safely convert any API value (string, number, Decimal, null, undefined) to a finite number
function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : fallback;
}

// Convert to a display string for an input; returns fallback if the value is not a valid number
function safeStr(val: unknown, fallback = ''): string {
  const n = safeNum(val, NaN);
  return Number.isFinite(n) ? String(n) : fallback;
}


export default function PlanForm({ projects, initialData, mode }: Props) {
  const action =
    mode === 'edit' && initialData
      ? updatePlanAction.bind(null, initialData.id)
      : createPlanAction;

  const [state, formAction] = useActionState<PlanFormState, FormData>(action, {});

  const d = initialData;

  // ── form state ────────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState(d?.projectId ?? '');
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitId, setUnitId] = useState(d?.unitId ?? '');
  // unitPrice tracks the current unit's price from the units list (not the stored plan price)
  const [unitPrice, setUnitPrice] = useState<number>(0);
  // In edit mode the price may have been customised; keep it editable by default
  const [manualPriceOverride, setManualPriceOverride] = useState(mode === 'edit');
  const [totalPrice, setTotalPrice] = useState(safeStr(d?.totalPrice));
  const [discountType, setDiscountType] = useState<DownPaymentType>(d?.discountType ?? 'FIXED');
  // For edit, prefer the stored raw value; fall back to the legacy amount.
  const [discountValue, setDiscountValue] = useState(
    safeStr(d?.discountValue ?? d?.discountAmount, '0'),
  );
  const [reservationAmountType, setReservationAmountType] = useState<DownPaymentType>(
    d?.reservationAmountType ?? 'FIXED',
  );
  // For edit, prefer the stored raw value; fall back to the legacy amount.
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

  // Duration options (multi). In edit mode initialise from existing; else start with one row.
  const [durationOptions, setDurationOptions] = useState<DurationOptionState[]>(() => {
    if (d?.durationOptions && d.durationOptions.length > 0) {
      return d.durationOptions.map((opt) => ({
        key: newDurationKey(),
        durationMonths: String(opt.durationMonths),
        increasePercentage: safeStr(opt.increasePercentage, '0'),
      }));
    }
    if (mode === 'edit') return []; // legacy plan being edited — leave options empty so user opts in
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

  // client-side unit validation
  const [unitTouched, setUnitTouched] = useState(false);

  // ── load units when project changes ──────────────────────────────────────
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

        // In edit mode, restore the unit price from the loaded list; totalPrice stays untouched
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

  // ── when unit changes, auto-fill price ───────────────────────────────────
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

  // ── manual price override toggle ──────────────────────────────────────────
  function handleManualOverrideChange(checked: boolean) {
    setManualPriceOverride(checked);
    if (!checked && unitPrice > 0) {
      // Reset total price to unit price
      setTotalPrice(String(unitPrice));
    }
  }

  // ── derived values ────────────────────────────────────────────────────────
  const tp = parseNum(totalPrice);
  // Discount: PERCENTAGE is of the total price (the pricing base).
  const discValue = parseNum(discountValue);
  const disc = discountType === 'PERCENTAGE' ? (tp * discValue) / 100 : discValue;
  const netPrice = tp - disc;
  const reservationValue = parseNum(reservationAmountValue);
  // Template preview: PERCENTAGE is of netPrice (mirrors down payment). At
  // reservation creation the percentage is re-applied to the selected unit price.
  const reservation =
    reservationAmountType === 'PERCENTAGE' ? (netPrice * reservationValue) / 100 : reservationValue;
  const dpVal = parseNum(downPaymentValue);
  const dpAmount = downPaymentType === 'PERCENTAGE' ? (netPrice * dpVal) / 100 : dpVal;

  const unitError = unitTouched && !unitId ? 'يرجى اختيار الوحدة' : undefined;

  // Derived: per-duration calculated rows
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
    if (months.some((m) => m <= 0))
      return 'كل مدة يجب أن تكون عدداً صحيحاً موجباً';
    const seen = new Set<number>();
    for (const m of months) {
      if (seen.has(m)) return `مدة التقسيط ${m} مكررة`;
      seen.add(m);
    }
    if (durationCalcRows.some((r) => r.pct < 0))
      return 'نسبة الزيادة يجب أن تكون صفراً أو أكثر';
    return null;
  })();

  const reservationPlusDownError =
    netPrice > 0 && reservation + dpAmount > netPrice
      ? 'مبلغ الحجز + الدفعة الأولى يتجاوزان صافي السعر'
      : null;

  const useDurationModel = durationOptions.length > 0;

  // Duration-option templates must declare a positive booking amount. The reservation
  // create flow reads InstallmentPlanTemplate.reservationAmount as the required booking
  // amount, and rejects plans with 0.
  const reservationAmountError =
    useDurationModel && reservation <= 0
      ? 'دفعة الحجز يجب أن تكون أكبر من صفر للخطط التي تستخدم خيارات المدة'
      : null;

  // ── numeric input helper: allows free typing ──────────────────────────────
  // We use type="text" + inputMode="decimal" so the browser never blocks
  // intermediate states (e.g. "1.", "0.0", "-" while typing)
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
        // Allow digits, a single decimal point, and empty string
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

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {/* ── Section 1: Plan Info ─────────────────────────────────────────── */}
      <FormSection
        title="معلومات الخطة"
        description="الاسم والوصف وربط الخطة بمشروع ووحدة."
      >
        <Field label="اسم الخطة" name="name" required>
          <Input
            id="name"
            name="name"
            required
            defaultValue={d?.name}
            placeholder="مثال: خطة 24 قسط شهري"
          />
        </Field>

        <Field label="وصف / ملاحظات" name="description">
          <Textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={d?.description ?? ''}
            placeholder="وصف اختياري للخطة..."
          />
        </Field>

        {/* Project — used to filter units */}
        <Field label="المشروع" name="projectId" required hint="اختر المشروع لتحميل الوحدات المتاحة">
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
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.ar}
              </option>
            ))}
          </Select>
        </Field>

        {/* Unit — always required, visible once project is selected */}
        <Field
          label="الوحدة"
          name="unitId"
          required
          error={unitError}
          hint={
            !projectId
              ? 'اختر المشروع أولاً لتحميل الوحدات'
              : unitsLoading
              ? 'جاري تحميل الوحدات…'
              : units.length === 0 && mode === 'create'
              ? 'لا توجد وحدات متاحة بدون خطة تقسيط في هذا المشروع'
              : units.length === 0
              ? 'لا توجد وحدات متاحة في هذا المشروع'
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
            <option value="">— اختر وحدة —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.type} — {formatCurrency(u.price)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="الحالة" name="status">
            <Select id="status" name="status" defaultValue={d?.status ?? 'DRAFT'}>
              <option value="DRAFT">مسودة</option>
              <option value="ACTIVE">نشطة</option>
              <option value="INACTIVE">غير نشطة</option>
            </Select>
          </Field>
          <Field label="الصلاحية" hint="ثابتة: للمبيعات فقط">
            <input type="hidden" name="visibility" value="SALES_ONLY" />
            <div className="h-10 flex items-center rounded-xl border border-hairline bg-slate-50 px-3 text-sm text-slate-500">
              مبيعات فقط
            </div>
          </Field>
        </div>
      </FormSection>

      {/* ── Section 2: Pricing ───────────────────────────────────────────── */}
      <FormSection
        title="التسعير"
        description="السعر الإجمالي والخصم وصافي السعر ومبلغ الحجز."
        aside={
          netPrice > 0 ? (
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm">
              <p className="text-brand-700 font-medium">صافي السعر</p>
              <p className="text-brand-900 text-lg font-bold mt-0.5">{formatCurrency(netPrice)}</p>
            </div>
          ) : null
        }
      >
        {/* Total price — read-only by default, editable when override is on */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="totalPrice" className="text-sm font-medium text-slate-700">
              السعر الإجمالي (ج.م)
              <span className="text-danger-600 ms-0.5">*</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={manualPriceOverride}
                onChange={(e) => handleManualOverrideChange(e.target.checked)}
                className="accent-brand-500 h-3.5 w-3.5"
              />
              <span className="text-xs text-slate-600">تعديل السعر يدوياً</span>
            </label>
          </div>
          <Input
            id="totalPrice"
            name="totalPrice"
            required
            readOnly={!manualPriceOverride}
            className={!manualPriceOverride ? 'bg-slate-50 text-slate-600 cursor-default' : ''}
            placeholder="يُحدَّد تلقائياً من سعر الوحدة"
            {...(manualPriceOverride
              ? numericInputProps(totalPrice, setTotalPrice, { allowEmpty: false })
              : { value: totalPrice, onChange: () => {} })}
          />
          <p className="text-xs text-slate-500">
            السعر الافتراضي مأخوذ من سعر الوحدة، ويمكن تعديله يدوياً عند الحاجة.
          </p>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700">نوع الخصم</span>
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
                <span>{t === 'FIXED' ? 'مبلغ ثابت' : 'نسبة مئوية %'}</span>
              </label>
            ))}
          </div>
        </div>

        <Field
          label={discountType === 'FIXED' ? 'قيمة الخصم (ج.م)' : 'نسبة الخصم (%)'}
          name="discountValue"
          hint={
            discountType === 'PERCENTAGE'
              ? 'نسبة من السعر الإجمالي. اتركها صفراً إذا لم يكن هناك خصم.'
              : 'اتركها صفراً إذا لم يكن هناك خصم'
          }
        >
          <Input
            id="discountValue"
            name="discountValue"
            placeholder={discountType === 'PERCENTAGE' ? '10' : '0'}
            {...numericInputProps(discountValue, setDiscountValue, { allowEmpty: true })}
          />
        </Field>

        {disc > 0 && (
          <div className="rounded-xl bg-slate-50 border border-hairline p-3 text-sm">
            <p className="text-slate-600 font-medium">
              {discountType === 'PERCENTAGE' ? 'قيمة الخصم المحتسبة' : 'قيمة الخصم'}
            </p>
            <p className="text-slate-900 text-lg font-bold mt-0.5">{formatCurrency(disc)}</p>
          </div>
        )}

        <div>
          <span className="text-sm font-medium text-slate-700">نوع دفعة الحجز</span>
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
                <span>{t === 'FIXED' ? 'مبلغ ثابت' : 'نسبة مئوية %'}</span>
              </label>
            ))}
          </div>
        </div>

        <Field
          label={reservationAmountType === 'FIXED' ? 'قيمة دفعة الحجز (ج.م)' : 'نسبة دفعة الحجز (%)'}
          name="reservationAmountValue"
          required
          hint={
            reservationAmountType === 'PERCENTAGE'
              ? 'نسبة من سعر الوحدة. تُحتسب القيمة من سعر الوحدة المختارة عند إنشاء الحجز. مطلوبة وأكبر من صفر للخطط التي تستخدم خيارات المدة.'
              : 'مبلغ الحجز المطلوب من العميل. يُستخدم تلقائياً عند إنشاء الحجز. مطلوب وأكبر من صفر للخطط التي تستخدم خيارات المدة.'
          }
        >
          <Input
            id="reservationAmountValue"
            name="reservationAmountValue"
            placeholder={reservationAmountType === 'PERCENTAGE' ? '10' : 'مثال: 50000'}
            {...numericInputProps(reservationAmountValue, setReservationAmountValue, { allowEmpty: true })}
          />
        </Field>

        {reservation > 0 && (
          <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm">
            <p className="text-brand-700 font-medium">
              {reservationAmountType === 'PERCENTAGE' ? 'دفعة الحجز المحتسبة (من صافي السعر)' : 'دفعة الحجز'}
            </p>
            <p className="text-brand-900 text-lg font-bold mt-0.5">{formatCurrency(reservation)}</p>
            {reservationAmountType === 'PERCENTAGE' && (
              <p className="text-brand-700/80 text-xs mt-1">
                عند إنشاء الحجز ستُحتسب النسبة من سعر الوحدة المختارة.
              </p>
            )}
          </div>
        )}
      </FormSection>

      {/* ── Section 3: Down Payment ──────────────────────────────────────── */}
      <FormSection
        title="الدفعة الأولى (المقدم)"
        description="حدد نوع المقدم وقيمته."
        aside={
          dpAmount > 0 ? (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm">
              <p className="text-amber-700 font-medium">قيمة المقدم</p>
              <p className="text-amber-900 text-lg font-bold mt-0.5">{formatCurrency(dpAmount)}</p>
            </div>
          ) : null
        }
      >
        <div>
          <span className="text-sm font-medium text-slate-700">نوع المقدم</span>
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
                <span>{t === 'FIXED' ? 'مبلغ ثابت' : 'نسبة مئوية %'}</span>
              </label>
            ))}
          </div>
        </div>

        <Field
          label={downPaymentType === 'FIXED' ? 'قيمة المقدم (ج.م)' : 'نسبة المقدم (%)'}
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
      </FormSection>

      {/* ── Section 4: Duration Options ─────────────────────────────────── */}
      <FormSection
        title="خيارات مدة التقسيط"
        description="حدد المدد المتاحة ونسبة الزيادة لكل مدة. المبيعات سيختارون مدة من القائمة فقط (نسبة الزيادة للعرض فقط ولا يمكنهم تعديلها)."
      >
        {/* Serialize duration options as a hidden JSON field for the server action */}
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
            <thead className="bg-slate-50 border-b border-hairline">
              <tr>
                <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">المدة (شهر)</th>
                <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">نسبة الزيادة %</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">المبلغ المُمول</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">القسط الشهري</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">إجمالي السداد</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {durationCalcRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                    {mode === 'edit'
                      ? 'خطة قديمة بدون خيارات مدة. اضغط "إضافة خيار مدة" للترقية إلى النظام الجديد.'
                      : 'أضف خيار مدة واحد على الأقل'}
                  </td>
                </tr>
              ) : (
                durationCalcRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50 transition-colors">
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
                        ? formatCurrency(row.financedAmount)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums font-medium">
                      {row.months > 0 && netPrice > 0
                        ? formatCurrency(row.monthlyInstallment)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-slate-700">
                      {row.months > 0 && netPrice > 0
                        ? formatCurrency(row.totalPayable)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <button
                        type="button"
                        onClick={() => removeDurationOption(row.key)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600 transition"
                        aria-label="حذف خيار المدة"
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
            إضافة خيار مدة
          </Button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          نسبة الزيادة تُطبَّق على المتبقي بعد دفعة الحجز والدفعة الأولى. الصيغة:{' '}
          <span className="font-mono" dir="ltr">
            financed = remaining × (1 + %); monthly = financed / months
          </span>
        </p>
      </FormSection>

      {/* ── Legacy fields — kept only when no duration options ──────────── */}
      {!useDurationModel && (
        <FormSection
          title="إعدادات قديمة (اختيارية)"
          description="هذه الحقول للخطط القديمة فقط. للخطط الجديدة استخدم خيارات المدة بالأعلى."
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="عدد الأقساط" name="installmentsCount">
              <Input
                id="installmentsCount"
                name="installmentsCount"
                placeholder="12"
                {...numericInputProps(installmentsCount, (v) => {
                  if (v === '' || /^[0-9]+$/.test(v)) setInstallmentsCount(v);
                })}
              />
            </Field>
            <Field label="تكرار القسط" name="frequency">
              <Select
                id="frequency"
                name="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as InstallmentFrequency)}
              >
                <option value="MONTHLY">شهري</option>
                <option value="QUARTERLY">ربع سنوي (كل 3 أشهر)</option>
                <option value="SEMI_ANNUAL">نصف سنوي (كل 6 أشهر)</option>
                <option value="YEARLY">سنوي</option>
              </Select>
            </Field>
          </div>

          <Field
            label="الدفعة الأخيرة (ج.م)"
            name="finalPaymentAmount"
            hint="اتركها فارغة إذا لم تكن هناك دفعة بالون"
          >
            <Input
              id="finalPaymentAmount"
              name="finalPaymentAmount"
              placeholder="0"
              {...numericInputProps(finalPaymentAmount, setFinalPaymentAmount, { allowEmpty: true })}
            />
          </Field>
        </FormSection>
      )}

      {/* ── Start-date rule (applies to both models) ────────────────────── */}
      <FormSection
        title="تاريخ بدء الأقساط"
        description="حدد متى يبدأ احتساب تواريخ الأقساط."
      >
        <div>
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
                    ? 'تاريخ محدد يدوياً'
                    : r === 'AFTER_RESERVATION'
                      ? 'بعد تاريخ الحجز'
                      : 'بعد تاريخ التعاقد'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {startDateRule === 'MANUAL' && (
          <Field label="تاريخ بدء الأقساط" name="manualStartDate" required>
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
      </FormSection>

      {/* ── Net price summary ─────────────────────────────────────────────── */}
      {netPrice > 0 && (
        <section className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm">
          <Calculator className="h-4 w-4 text-brand-600" />
          <span className="text-slate-500">صافي السعر:</span>
          <span className="font-bold text-slate-900">{formatCurrency(netPrice)}</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="text-slate-500">المتبقي بعد الحجز والدفعة الأولى:</span>
          <span className="font-bold text-slate-900">
            {formatCurrency(Math.max(0, netPrice - reservation - dpAmount))}
          </span>
        </section>
      )}

      <FormFooter
        sticky
        primary={
          <SubmitButton pendingLabel="جاري الحفظ…">
            {mode === 'create' ? 'إنشاء الخطة' : 'حفظ التعديلات'}
          </SubmitButton>
        }
        secondary={
          <Link href="/dashboard/installments">
            <Button variant="ghost" size="md" type="button">
              إلغاء
            </Button>
          </Link>
        }
      />
    </form>
  );
}
