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
  PlanTemplateStatus,
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

const FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  SEMI_ANNUAL: 'نصف سنوي',
  YEARLY: 'سنوي',
};

const PAYMENT_TYPE_LABELS: Record<PlanPaymentType, string> = {
  RESERVATION: 'دفعة حجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
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
    return 'مجموع الدفعة الأولى + الحجز + الدفعة الأخيرة يتجاوز صافي السعر';
  if (installmentsCount < 1) return 'عدد الأقساط يجب أن يكون 1 على الأقل';
  return null;
}

export default function PlanForm({ projects, initialData, mode }: Props) {
  const action = mode === 'edit' && initialData
    ? updatePlanAction.bind(null, initialData.id)
    : createPlanAction;

  const [state, formAction] = useActionState<PlanFormState, FormData>(action, {});

  const d = initialData;

  // form state
  const [projectId, setProjectId] = useState(d?.projectId ?? '');
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState(d?.unitId ?? '');
  const [totalPrice, setTotalPrice] = useState(d ? String(Number(d.totalPrice)) : '');
  const [discountAmount, setDiscountAmount] = useState(d ? String(Number(d.discountAmount)) : '0');
  const [reservationAmount, setReservationAmount] = useState(
    d ? String(Number(d.reservationAmount)) : '0',
  );
  const [downPaymentType, setDownPaymentType] = useState<DownPaymentType>(
    d?.downPaymentType ?? 'FIXED',
  );
  const [downPaymentValue, setDownPaymentValue] = useState(
    d ? String(Number(d.downPaymentValue)) : '',
  );
  const [installmentsCount, setInstallmentsCount] = useState(d ? String(d.installmentsCount) : '12');
  const [frequency, setFrequency] = useState<InstallmentFrequency>(d?.frequency ?? 'MONTHLY');
  const [startDateRule, setStartDateRule] = useState<StartDateRule>(
    d?.startDateRule ?? 'AFTER_CONTRACT',
  );
  const [manualStartDate, setManualStartDate] = useState(
    d?.manualStartDate ? d.manualStartDate.slice(0, 10) : '',
  );
  const [finalPaymentAmount, setFinalPaymentAmount] = useState(
    d?.finalPaymentAmount ? String(Number(d.finalPaymentAmount)) : '',
  );

  // Load units when project changes
  useEffect(() => {
    if (!projectId) {
      setUnits([]);
      setUnitId('');
      return;
    }
    fetch(`/api-proxy/units?projectId=${projectId}&pageSize=200&status=AVAILABLE`)
      .then((r) => r.json())
      .then((data) => {
        const list: UnitOption[] = (data?.data ?? []).map((u: UnitOption) => ({
          id: u.id,
          code: u.code,
          type: u.type,
          price: u.price,
        }));
        setUnits(list);
        // pre-fill price from unit if one is selected
        if (d?.unitId && list.find((u) => u.id === d.unitId)) {
          setUnitId(d.unitId);
        }
      })
      .catch(() => setUnits([]));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When unit selection changes, optionally update price
  function handleUnitChange(id: string) {
    setUnitId(id);
    if (!id) return;
    const unit = units.find((u) => u.id === id);
    if (unit && !totalPrice) {
      setTotalPrice(String(Number(unit.price)));
    }
  }

  // derived values
  const tp = parseFloat(totalPrice) || 0;
  const disc = parseFloat(discountAmount) || 0;
  const netPrice = tp - disc;
  const reservation = parseFloat(reservationAmount) || 0;
  const dpVal = parseFloat(downPaymentValue) || 0;
  const dpAmount =
    downPaymentType === 'PERCENTAGE' ? (netPrice * dpVal) / 100 : dpVal;
  const installments = parseInt(installmentsCount) || 0;
  const finalAmt = parseFloat(finalPaymentAmount) || 0;

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

  const validationError = validateSchedule({
    netPrice,
    reservationAmount: reservation,
    downPaymentAmount: dpAmount,
    finalPaymentAmount: finalAmt,
    installmentsCount: installments,
  });

  const paymentTypeBadgeClass: Record<PlanPaymentType, string> = {
    RESERVATION: 'bg-blue-50 text-blue-700',
    DOWN_PAYMENT: 'bg-amber-50 text-amber-700',
    INSTALLMENT: 'bg-slate-50 text-slate-700',
    FINAL_PAYMENT: 'bg-purple-50 text-purple-700',
  };

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
        description="الاسم والوصف وربط الخطة بمشروع أو وحدة."
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

        <Field label="المشروع" name="projectId" required>
          <Select
            id="projectId"
            name="projectId"
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.ar}
              </option>
            ))}
          </Select>
        </Field>

        {units.length > 0 && (
          <Field label="الوحدة (اختياري)" name="unitId" hint="إذا تركتها فارغة تنطبق الخطة على المشروع بأكمله">
            <Select
              id="unitId"
              name="unitId"
              value={unitId}
              onChange={(e) => handleUnitChange(e.target.value)}
            >
              <option value="">— بدون وحدة محددة —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.type} — {formatCurrency(u.price)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {/* hidden unitId when no units loaded but editing existing */}
        {units.length === 0 && unitId && (
          <input type="hidden" name="unitId" value={unitId} />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="الحالة" name="status">
            <Select id="status" name="status" defaultValue={d?.status ?? 'DRAFT'}>
              <option value="DRAFT">مسودة</option>
              <option value="ACTIVE">نشطة</option>
              <option value="INACTIVE">غير نشطة</option>
            </Select>
          </Field>
          <Field label="الصلاحية" name="visibility" hint="ثابتة: للمبيعات فقط">
            <Input
              id="visibility"
              name="visibility"
              value="SALES_ONLY"
              readOnly
              className="bg-slate-50 text-slate-500 cursor-not-allowed"
            />
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
        <Field label="السعر الإجمالي (ج.م)" name="totalPrice" required>
          <Input
            id="totalPrice"
            name="totalPrice"
            type="number"
            min="0"
            step="0.01"
            required
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="قيمة الخصم (ج.م)" name="discountAmount" hint="اتركها صفراً إذا لم يكن هناك خصم">
          <Input
            id="discountAmount"
            name="discountAmount"
            type="number"
            min="0"
            step="0.01"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="دفعة الحجز (ج.م)" name="reservationAmount" hint="المبلغ الأولي الذي يدفعه العميل عند الحجز">
          <Input
            id="reservationAmount"
            name="reservationAmount"
            type="number"
            min="0"
            step="0.01"
            value={reservationAmount}
            onChange={(e) => setReservationAmount(e.target.value)}
            placeholder="0.00"
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
            type="number"
            min="0"
            step={downPaymentType === 'PERCENTAGE' ? '0.1' : '0.01'}
            max={downPaymentType === 'PERCENTAGE' ? '100' : undefined}
            required
            value={downPaymentValue}
            onChange={(e) => setDownPaymentValue(e.target.value)}
            placeholder={downPaymentType === 'PERCENTAGE' ? '10' : '0.00'}
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
              type="number"
              min="1"
              max="360"
              required
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(e.target.value)}
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

        <Field label="الدفعة الأخيرة (ج.م)" name="finalPaymentAmount" hint="اتركها فارغة إذا لم تكن هناك دفعة أخيرة بالون">
          <Input
            id="finalPaymentAmount"
            name="finalPaymentAmount"
            type="number"
            min="0"
            step="0.01"
            value={finalPaymentAmount}
            onChange={(e) => setFinalPaymentAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      </FormSection>

      {/* ── Section 5: Schedule Preview ──────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">معاينة جدول السداد</h2>
          {netPrice > 0 && (
            <span className="text-xs text-slate-500 me-auto">
              صافي السعر: {formatCurrency(netPrice)} | {scheduleRows.length} دفعة
            </span>
          )}
        </div>

        {validationError && (
          <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{validationError}</p>
          </div>
        )}

        {scheduleRows.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-surface p-8 text-center text-sm text-slate-400">
            أدخل تفاصيل الخطة لمعاينة جدول السداد
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
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentTypeBadgeClass[row.paymentType]}`}
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
