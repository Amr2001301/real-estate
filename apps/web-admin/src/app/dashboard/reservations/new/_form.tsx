'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import type { LeadStage } from '@/lib/types';
import { computeDurationOption } from '@/lib/installment-calc';
import { createReservationAction, type ReservationFormState } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';

interface Unit {
  id: string;
  code: string;
  type: string;
  // P8 — preview source for PERCENTAGE booking mode. Display only; backend
  // recomputes from the canonical Unit row when the reservation is created.
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
}

function toFiniteOrEmpty(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? String(n) : '';
}

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'جديد',
  INTERESTED: 'مهتم',
  VISIT: 'زيارة',
  NEGOTIATION: 'تفاوض',
  WON: 'تم البيع',
  LOST: 'خسارة',
};

const ROLE_LABELS: Record<'CLIENT' | 'CUSTOMER', string> = {
  CLIENT: 'عميل مسجل',
  CUSTOMER: 'عميل مشتري',
};

function formatLeadLabel(l: Lead): string {
  const project = l.projectInterest?.name.ar ?? 'بدون تحديد مشروع';
  const stage = STAGE_LABELS[l.stage] ?? l.stage;
  return `${l.fullName} — ${project} — ${stage} — ${l.phone}`;
}

function formatClientLabel(c: Client): string {
  const role = ROLE_LABELS[c.role];
  const phone = c.phone ?? 'بدون هاتف';
  return `${c.fullName} — ${role} — ${phone}`;
}

export default function NewReservationForm({
  units,
  leads,
  clients,
  salesOptions,
  plans,
}: Props) {
  const [state, formAction] = useActionState<ReservationFormState, FormData>(
    createReservationAction,
    {},
  );
  const [ownerType, setOwnerType] = useState<'lead' | 'client'>('lead');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedDurationOptionId, setSelectedDurationOptionId] = useState('');
  // P8 — booking amount mode. PLAN keeps the legacy plan-driven behavior
  // (server copies plan.reservationAmount; admin doesn't enter a value);
  // FIXED + PERCENTAGE are admin overrides.
  const [bookingAmountMode, setBookingAmountMode] = useState<'PLAN' | 'FIXED' | 'PERCENTAGE'>('PLAN');
  const [fixedAmountInput, setFixedAmountInput] = useState('');
  const [percentInput, setPercentInput] = useState('');

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [selectedUnitId, units],
  );
  const selectedProjectId =
    selectedUnit?.building?.phase?.projectId ?? selectedUnit?.building?.phase?.project?.id ?? '';

  // Plans applicable to the selected unit: same project AND (plan.unitId is null OR matches unit)
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
    // Reset plan + duration when unit changes (different project ⇒ different plans)
    setSelectedPlanId('');
    setSelectedDurationOptionId('');
  }

  function handlePlanChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPlanId(e.target.value);
    // Force the user to pick a duration explicitly — never auto-select.
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

  // P8 — preview of the booking amount the server will compute for the chosen
  // mode. Mirrors the backend math: unit.price × percent / 100, rounded to 2dp.
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

  // Live snapshot preview using the same formula the backend uses
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

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <FormSection
        title="الوحدة العقارية"
        description="اختر الوحدة المراد حجزها. يجب أن تكون الوحدة في حالة متاحة."
      >
        <Field label="الوحدة" name="unitId" required>
          <Select name="unitId" required value={selectedUnitId} onChange={handleUnitChange}>
            <option value="">— اختر وحدة —</option>
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
      </FormSection>

      <FormSection
        title="العميل"
        description="اختر مصدر واحد فقط: إما عميل محتمل من CRM، أو عميل مسجل في النظام."
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">نوع المالك</span>
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
              <span>عميل محتمل من CRM</span>
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
              <span>عميل مسجل</span>
            </label>
          </div>
        </div>

        {ownerType === 'lead' ? (
          <Field
            label="العميل المحتمل (Lead)"
            name="leadId"
            hint="فرصة من CRM — اسم، مشروع الاهتمام، مرحلة، هاتف"
            required
          >
            <Select name="leadId" required>
              <option value="">— اختر فرصة —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatLeadLabel(l)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="العميل المسجل"
            name="clientId"
            hint="حساب مسجل في النظام — اسم، نوع الحساب، هاتف"
            required
          >
            <Select name="clientId" required>
              <option value="">— اختر عميلاً مسجلاً —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClientLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </FormSection>

      <FormSection
        title="تفاصيل الحجز"
        description="حدد المندوب المسؤول، مدة صلاحية الحجز، وأي ملاحظات داخلية."
      >
        <Field label="المندوب المسؤول" name="salesId">
          <Select name="salesId">
            <option value="">— اختر مندوباً —</option>
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {salesActorLabel(s)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="صلاحية الحجز (بالساعات)"
          name="expiresInHours"
          hint="المدة الزمنية التي يبقى فيها الحجز قيد المراجعة قبل انتهائه تلقائياً"
        >
          <Select name="expiresInHours" defaultValue="72">
            <option value="24">24 ساعة (يوم)</option>
            <option value="48">48 ساعة (يومان)</option>
            <option value="72">72 ساعة (3 أيام) — افتراضي</option>
            <option value="120">120 ساعة (5 أيام)</option>
            <option value="168">168 ساعة (أسبوع)</option>
            <option value="336">336 ساعة (أسبوعان)</option>
          </Select>
        </Field>

        <Field label="ملاحظات" name="notes" hint="ملاحظات داخلية اختيارية">
          <Textarea name="notes" rows={3} placeholder="أضف ملاحظات اختيارية…" />
        </Field>
      </FormSection>

      <FormSection
        title="خطة التقسيط ومبلغ الحجز"
        description="اختر خطة التقسيط للوحدة، أو حدِّد مبلغ الحجز يدوياً (قيمة ثابتة أو نسبة من سعر الوحدة)."
      >
        <Field
          label="خطة التقسيط"
          name="installmentPlanTemplateId"
          hint={
            !selectedUnitId
              ? 'اختر الوحدة أولاً لعرض الخطط المتاحة'
              : availablePlans.length === 0
                ? 'لا توجد خطط نشطة لهذه الوحدة/المشروع'
                : 'مبلغ الحجز المطلوب يتم تحديده تلقائياً من الخطة المختارة.'
          }
        >
          <Select
            name="installmentPlanTemplateId"
            value={selectedPlanId}
            onChange={handlePlanChange}
            disabled={!selectedUnitId || availablePlans.length === 0}
          >
            <option value="">— بدون خطة (اختياري) —</option>
            {availablePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — مبلغ الحجز: {p.reservationAmount}
              </option>
            ))}
          </Select>
        </Field>

        {selectedPlanInvalid && (
          <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">لا يمكن استخدام هذه الخطة لإنشاء حجز.</p>
              <p className="text-xs mt-1">
                الخطة المختارة لا تحدد دفعة الحجز (reservationAmount = 0). يرجى تعديل الخطة
                وتحديد قيمة موجبة لـ &laquo;دفعة الحجز&raquo; قبل ربطها بحجز جديد.
              </p>
            </div>
          </div>
        )}

        {selectedPlan && (
          <div className="rounded-2xl border border-hairline bg-surface p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">تفاصيل الخطة المختارة</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">مبلغ الحجز المطلوب</dt>
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
                  <dt className="text-slate-500">الدفعة الأولى</dt>
                  <dd className="font-medium tabular-nums">
                    {toFiniteOrEmpty(selectedPlan.downPaymentAmount) || '0'}
                  </dd>
                </div>
              )}
              {selectedPlan.durationOptions.length > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">خيارات المدة المتاحة</dt>
                  <dd className="font-medium tabular-nums">
                    {selectedPlan.durationOptions.length}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between sm:col-span-2 border-t border-hairline pt-2 mt-1">
                <dt className="text-slate-500">حالة دفع مبلغ الحجز</dt>
                <dd className="font-medium text-amber-700">غير مدفوع (سيتم التأكيد لاحقاً)</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-400 leading-relaxed">
              مبلغ الحجز المطلوب يتم تحديده من خطة التقسيط ولا يمكن للمبيعات تعديله. تأكيد السداد يتم من صفحة تفاصيل الحجز بعد الإنشاء.
            </p>
          </div>
        )}

        {/* P8 — Booking amount mode. PLAN keeps the current behavior (server
            copies plan.reservationAmount). FIXED + PERCENTAGE are admin
            overrides; the radio sends `bookingAmountMode` only when the admin
            chose an override. */}
        <div className="rounded-2xl border border-hairline bg-surface p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">طريقة تحديد مبلغ الحجز</h3>
            <p className="text-xs text-slate-500 mt-1">
              يمكنك ترك مبلغ الحجز ليُحسب من خطة التقسيط، أو إدخاله يدوياً كقيمة ثابتة أو كنسبة من سعر الوحدة.
            </p>
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
              <span>من خطة التقسيط</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="bookingAmountModeRadio"
                value="FIXED"
                checked={bookingAmountMode === 'FIXED'}
                onChange={() => setBookingAmountMode('FIXED')}
              />
              <span>مبلغ ثابت</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="bookingAmountModeRadio"
                value="PERCENTAGE"
                checked={bookingAmountMode === 'PERCENTAGE'}
                onChange={() => setBookingAmountMode('PERCENTAGE')}
              />
              <span>نسبة من سعر الوحدة</span>
            </label>
          </div>
          {/* Hidden field sent to the server only when admin chose an override. */}
          {(bookingAmountMode === 'FIXED' || bookingAmountMode === 'PERCENTAGE') && (
            <input type="hidden" name="bookingAmountMode" value={bookingAmountMode} />
          )}

          {bookingAmountMode === 'FIXED' && (
            <Field
              label="مبلغ الحجز (قيمة ثابتة)"
              name="bookingAmount"
              hint="أدخل مبلغاً موجباً. سيُسجَّل كـ FIXED ويُسترجع في تفاصيل الحجز."
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
                placeholder="مثلاً 50000"
                required
              />
            </Field>
          )}

          {bookingAmountMode === 'PERCENTAGE' && (
            <>
              <Field
                label="النسبة المئوية من سعر الوحدة"
                name="bookingAmountPercent"
                hint="نسبة بين 0.01 و 100. سيتم حساب المبلغ تلقائياً وعرضه قبل الإرسال."
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
                  placeholder="مثلاً 5"
                  required
                />
              </Field>
              <div className="rounded-xl bg-slate-50 border border-hairline p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">سعر الوحدة المختارة</span>
                  <span className="font-medium tabular-nums">
                    {selectedUnitPrice > 0 ? selectedUnitPrice.toLocaleString('ar') : '— غير محدد —'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">مبلغ الحجز المحسوب</span>
                  <span className="font-bold tabular-nums text-brand-700">
                    {percentPreviewAmount != null
                      ? percentPreviewAmount.toLocaleString('ar')
                      : '—'}
                  </span>
                </div>
                {selectedUnitPrice <= 0 && (
                  <p className="text-xs text-danger-700 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    لا يمكن حساب النسبة لأن سعر الوحدة غير محدد. اختر وحدة بسعر &gt; 0 أو استخدم وضع المبلغ الثابت.
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
              label="مدة التقسيط"
              name="installmentPlanDurationOptionSelect"
              required
              hint="اختر مدة التقسيط بعد الاتفاق مع العميل. القيم المالية أدناه يتم حفظها كلقطة وقت إنشاء الحجز."
            >
              <Select
                name="installmentPlanDurationOptionSelect"
                value={selectedDurationOptionId}
                onChange={(e) => setSelectedDurationOptionId(e.target.value)}
                required
              >
                <option value="">— اختر مدة —</option>
                {selectedPlan!.durationOptions
                  .slice()
                  .sort((a, b) => a.durationMonths - b.durationMonths)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.durationMonths} شهر — زيادة {Number(o.increasePercentage)}%
                    </option>
                  ))}
              </Select>
            </Field>

            {durationMissing && (
              <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>اختر مدة التقسيط قبل إنشاء الحجز.</p>
              </div>
            )}

            {selectedDuration && previewSnapshot && (
              <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  لقطة الحساب (سيتم حفظها مع الحجز)
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">مدة التقسيط</dt>
                    <dd className="font-medium tabular-nums">
                      {selectedDuration.durationMonths} شهر
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">نسبة الزيادة</dt>
                    <dd className="font-medium tabular-nums">
                      {Number(selectedDuration.increasePercentage)}%
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">المبلغ المتبقي</dt>
                    <dd className="font-medium tabular-nums">
                      {previewSnapshot.remainingAmount.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">المبلغ الممول</dt>
                    <dd className="font-medium tabular-nums">
                      {previewSnapshot.financedAmount.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between sm:col-span-2 border-t border-hairline pt-2 mt-1">
                    <dt className="text-slate-700 font-medium">القسط الشهري</dt>
                    <dd className="font-bold tabular-nums text-brand-700 text-base">
                      {previewSnapshot.monthlyInstallment.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between sm:col-span-2">
                    <dt className="text-slate-700 font-medium">إجمالي السداد</dt>
                    <dd className="font-bold tabular-nums">
                      {previewSnapshot.totalPayable.toFixed(2)}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-400 leading-relaxed">
                  نسبة الزيادة والقيم المحسوبة للعرض فقط ولا يمكن للمبيعات تعديلها. سيتم تجميد هذه القيم على الحجز عند الإنشاء.
                </p>
              </div>
            )}
          </>
        )}

        <Field label="ملاحظات مبلغ الحجز" name="bookingNotes">
          <Textarea name="bookingNotes" rows={2} placeholder="ملاحظات داخلية اختيارية حول مبلغ الحجز…" />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={
          selectedPlanInvalid || durationMissing ? (
            <Button type="button" variant="primary" size="md" disabled>
              إنشاء الحجز
            </Button>
          ) : (
            <SubmitButton>إنشاء الحجز</SubmitButton>
          )
        }
        secondary={
          <Link href="/dashboard/reservations">
            <Button variant="ghost" size="md" type="button">
              إلغاء
            </Button>
          </Link>
        }
      />
    </form>
  );
}
