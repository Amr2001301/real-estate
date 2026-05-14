'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Calculator } from 'lucide-react';
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
  PlanPaymentType,
} from '@/lib/types';
import { createPlanAction, updatePlanAction, type PlanFormState } from './actions';

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

interface ScheduleRow {
  paymentNumber: number;
  paymentType: PlanPaymentType;
  label: string;
  dueDateLabel: string;
  amount: number;
  remainingBalance: number;
}

const FREQUENCY_MONTHS: Record<InstallmentFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  YEARLY: 12,
};

const PAYMENT_TYPE_LABELS: Record<PlanPaymentType, string> = {
  RESERVATION: 'دفعة حجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

const PAYMENT_TYPE_BADGE: Record<PlanPaymentType, string> = {
  RESERVATION: 'bg-blue-50 text-blue-700',
  DOWN_PAYMENT: 'bg-amber-50 text-amber-700',
  INSTALLMENT: 'bg-slate-50 text-slate-700',
  FINAL_PAYMENT: 'bg-purple-50 text-purple-700',
};

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
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

function computeSchedule(params: {
  totalPrice: number;
  discountAmount: number;
  reservationAmount: number;
  downPaymentType: DownPaymentType;
  downPaymentValue: number;
  installmentsCount: number;
  frequency: InstallmentFrequency;
  startDateRule: StartDateRule;
  manualStartDate: string;
  finalPaymentAmount: number;
}): ScheduleRow[] {
  const {
    totalPrice,
    discountAmount,
    reservationAmount,
    downPaymentType,
    downPaymentValue,
    installmentsCount,
    frequency,
    startDateRule,
    manualStartDate,
    finalPaymentAmount,
  } = params;

  if (totalPrice <= 0 || installmentsCount < 1) return [];

  const netPrice = totalPrice - discountAmount;
  const dpAmount =
    downPaymentType === 'PERCENTAGE'
      ? (netPrice * downPaymentValue) / 100
      : downPaymentValue;
  const finalAmt = finalPaymentAmount ?? 0;
  const remaining = netPrice - reservationAmount - dpAmount - finalAmt;
  const perInstallment = installmentsCount > 0 ? remaining / installmentsCount : 0;

  const monthStep = FREQUENCY_MONTHS[frequency];
  const startDate =
    startDateRule === 'MANUAL' && manualStartDate ? new Date(manualStartDate) : null;

  const rows: ScheduleRow[] = [];
  let paymentNumber = 1;
  let remainingBalance = netPrice;

  if (reservationAmount > 0) {
    remainingBalance -= reservationAmount;
    rows.push({
      paymentNumber: paymentNumber++,
      paymentType: 'RESERVATION',
      label: PAYMENT_TYPE_LABELS.RESERVATION,
      dueDateLabel: 'عند الحجز',
      amount: reservationAmount,
      remainingBalance,
    });
  }

  remainingBalance -= dpAmount;
  rows.push({
    paymentNumber: paymentNumber++,
    paymentType: 'DOWN_PAYMENT',
    label: PAYMENT_TYPE_LABELS.DOWN_PAYMENT,
    dueDateLabel: 'عند التعاقد',
    amount: dpAmount,
    remainingBalance,
  });

  for (let i = 0; i < installmentsCount; i++) {
    let dueDateLabel = '—';
    if (startDate) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i * monthStep);
      dueDateLabel = formatDateLabel(d);
    } else if (startDateRule === 'AFTER_RESERVATION') {
      dueDateLabel = `بعد الحجز بـ ${i * monthStep + monthStep} شهر`;
    } else {
      dueDateLabel = `بعد التعاقد بـ ${i * monthStep + monthStep} شهر`;
    }
    remainingBalance -= perInstallment;
    rows.push({
      paymentNumber: paymentNumber++,
      paymentType: 'INSTALLMENT',
      label: `${PAYMENT_TYPE_LABELS.INSTALLMENT} ${i + 1}`,
      dueDateLabel,
      amount: perInstallment,
      remainingBalance,
    });
  }

  if (finalAmt > 0) {
    remainingBalance -= finalAmt;
    rows.push({
      paymentNumber: paymentNumber++,
      paymentType: 'FINAL_PAYMENT',
      label: PAYMENT_TYPE_LABELS.FINAL_PAYMENT,
      dueDateLabel: '—',
      amount: finalAmt,
      remainingBalance,
    });
  }

  return rows;
}

function validateSchedule(params: {
  netPrice: number;
  reservationAmount: number;
  downPaymentAmount: number;
  finalPaymentAmount: number;
  installmentsCount: number;
}): string | null {
  const { netPrice, reservationAmount, downPaymentAmount, finalPaymentAmount, installmentsCount } =
    params;
  if (netPrice <= 0) return null;
  if (downPaymentAmount > netPrice) return 'الدفعة الأولى تتجاوز صافي السعر';
  if (reservationAmount + downPaymentAmount + finalPaymentAmount > netPrice)
    return 'مجموع الحجز + المقدم + الدفعة الأخيرة يتجاوز صافي السعر';
  if (installmentsCount < 1) return 'عدد الأقساط يجب أن يكون 1 على الأقل';
  return null;
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
  const [discountAmount, setDiscountAmount] = useState(safeStr(d?.discountAmount, '0'));
  const [reservationAmount, setReservationAmount] = useState(safeStr(d?.reservationAmount, '0'));
  const [downPaymentType, setDownPaymentType] = useState<DownPaymentType>(
    d?.downPaymentType ?? 'FIXED',
  );
  const [downPaymentValue, setDownPaymentValue] = useState(safeStr(d?.downPaymentValue));
  const [installmentsCount, setInstallmentsCount] = useState(
    d ? String(d.installmentsCount) : '12',
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
    fetch(`/api-proxy/units?projectId=${projectId}&pageSize=200`)
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
  }, [projectId]);

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
  const disc = parseNum(discountAmount);
  const netPrice = tp - disc;
  const reservation = parseNum(reservationAmount);
  const dpVal = parseNum(downPaymentValue);
  const dpAmount = downPaymentType === 'PERCENTAGE' ? (netPrice * dpVal) / 100 : dpVal;
  const installments = parseInt(installmentsCount) || 0;
  const finalAmt = parseNum(finalPaymentAmount);

  const scheduleRows = computeSchedule({
    totalPrice: tp,
    discountAmount: disc,
    reservationAmount: reservation,
    downPaymentType,
    downPaymentValue: dpVal,
    installmentsCount: installments,
    frequency,
    startDateRule,
    manualStartDate,
    finalPaymentAmount: finalAmt,
  });

  const scheduleError = validateSchedule({
    netPrice,
    reservationAmount: reservation,
    downPaymentAmount: dpAmount,
    finalPaymentAmount: finalAmt,
    installmentsCount: installments,
  });

  const unitError = unitTouched && !unitId ? 'يرجى اختيار الوحدة' : undefined;

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

        <Field
          label="قيمة الخصم (ج.م)"
          name="discountAmount"
          hint="اتركها صفراً إذا لم يكن هناك خصم"
        >
          <Input
            id="discountAmount"
            name="discountAmount"
            placeholder="0"
            {...numericInputProps(discountAmount, setDiscountAmount)}
          />
        </Field>

        <Field
          label="دفعة الحجز (ج.م)"
          name="reservationAmount"
          hint="المبلغ الأولي الذي يدفعه العميل عند الحجز"
        >
          <Input
            id="reservationAmount"
            name="reservationAmount"
            placeholder="0"
            {...numericInputProps(reservationAmount, setReservationAmount)}
          />
        </Field>
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

      {/* ── Section 4: Installment Schedule ─────────────────────────────── */}
      <FormSection
        title="الأقساط"
        description="عدد الأقساط، التكرار، وقاعدة تاريخ البدء."
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="عدد الأقساط" name="installmentsCount" required>
            <Input
              id="installmentsCount"
              name="installmentsCount"
              placeholder="12"
              {...numericInputProps(installmentsCount, (v) => {
                // Only allow integers for installments count
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

        <div>
          <span className="text-sm font-medium text-slate-700">قاعدة تاريخ البدء</span>
          <div className="flex flex-col gap-2 mt-2">
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

      {/* ── Section 5: Schedule Preview ──────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">معاينة جدول السداد</h2>
          {netPrice > 0 && (
            <span className="text-xs text-slate-500 ms-auto">
              صافي السعر: {formatCurrency(netPrice)} | {scheduleRows.length} دفعة
            </span>
          )}
        </div>

        {scheduleError && (
          <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{scheduleError}</p>
          </div>
        )}

        {scheduleRows.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-surface p-8 text-center text-sm text-slate-400">
            {!unitId
              ? 'اختر المشروع والوحدة لمعاينة جدول السداد'
              : 'أدخل تفاصيل التسعير والأقساط لمعاينة جدول السداد'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-hairline">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-hairline">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500">#</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500">نوع الدفعة</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500">تاريخ الاستحقاق</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500">المبلغ</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {scheduleRows.map((row) => (
                  <tr key={row.paymentNumber} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{row.paymentNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_TYPE_BADGE[row.paymentType]}`}
                      >
                        {row.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{row.dueDateLabel}</td>
                    <td className="px-4 py-3 text-end font-medium tabular-nums">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-end text-slate-500 tabular-nums text-xs">
                      {formatCurrency(Math.max(0, row.remainingBalance))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-700">
                    الإجمالي
                  </td>
                  <td className="px-4 py-3 text-end font-bold text-slate-900 tabular-nums">
                    {formatCurrency(scheduleRows.reduce((s, r) => s + r.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

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
