import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Building2, Home, ChevronLeft } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { InstallmentPlanTemplate, PlanPaymentType } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { PlanTemplateStatusBadge } from '@/components/badges';
import { PlanDetailActions } from '../_components/plan-detail-actions';
import { DurationSelector } from './_components/duration-selector';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

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

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  SEMI_ANNUAL: 'نصف سنوي',
  YEARLY: 'سنوي',
};

const START_DATE_RULE_LABELS: Record<string, string> = {
  MANUAL: 'تاريخ محدد يدوياً',
  AFTER_RESERVATION: 'بعد تاريخ الحجز',
  AFTER_CONTRACT: 'بعد تاريخ التعاقد',
};

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

export default async function InstallmentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [planRes, session] = await Promise.all([
    safe(api.get<InstallmentPlanTemplate>(`/installment-plan-templates/${id}`)),
    getSession(),
  ]);

  if (planRes.error || !planRes.data) notFound();

  const plan = planRes.data;
  const isAdmin = session?.role === 'ADMIN';
  const scheduleItems = plan.scheduleItems ?? [];
  const durationOptions = plan.durationOptions ?? [];
  const hasDurationOptions = durationOptions.length > 0;

  return (
    <div className="space-y-5 pb-2">
      <PremiumPageHero
        title={plan.name}
        description={plan.description ?? 'خطة تقسيط'}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'خطط التقسيط', href: '/dashboard/installments' },
          { label: plan.name },
        ]}
        meta={<PlanTemplateStatusBadge status={plan.status} />}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              {plan.status !== 'ACTIVE' && (
                <PlanDetailActions planId={plan.id} action="activate" />
              )}
              {plan.status === 'ACTIVE' && (
                <PlanDetailActions planId={plan.id} action="deactivate" />
              )}
              <Link href={`/dashboard/installments/${id}/edit`}>
                <Button variant="outline" size="md" leftIcon={<Pencil className="h-4 w-4" />}>
                  تعديل
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            {/* Plan details */}
            <PremiumSectionCard title="تفاصيل الخطة">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="صافي السعر">
                  <span className="text-[15px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(plan.netPrice)}
                  </span>
                </Field>
                <Field label="السعر الإجمالي">
                  <span className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(plan.totalPrice)}
                  </span>
                </Field>
                {Number(plan.discountAmount) > 0 && (
                  <Field label="الخصم">
                    <span className="text-[14px] font-bold tabular-nums text-success-700">
                      − {formatCurrency(plan.discountAmount)}
                    </span>
                  </Field>
                )}
                <Field label="دفعة الحجز">
                  <div>
                    <span className={`text-[14px] font-bold tabular-nums ${Number(plan.reservationAmount) > 0 ? 'text-slate-900' : 'text-warning-600'}`}>
                      {formatCurrency(plan.reservationAmount)}
                    </span>
                    {Number(plan.reservationAmount) <= 0 && (
                      <p className="text-[10px] text-warning-700 mt-0.5">
                        يجب تحديد دفعة الحجز قبل استخدام الخطة
                      </p>
                    )}
                  </div>
                </Field>
                <Field label="الدفعة الأولى">
                  <span className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(plan.downPaymentAmount)}
                    {plan.downPaymentType === 'PERCENTAGE' && (
                      <span className="text-[12px] font-semibold text-slate-400 ms-1.5">
                        ({Number(plan.downPaymentValue)}%)
                      </span>
                    )}
                  </span>
                </Field>
                <Field label={hasDurationOptions ? 'خيارات المدة' : 'عدد الأقساط'}>
                  <span className="text-[14px] font-bold text-slate-900">
                    {hasDurationOptions
                      ? `${durationOptions.length} خيار`
                      : plan.installmentsCount != null
                        ? `${plan.installmentsCount} قسط`
                        : '—'}
                  </span>
                </Field>
                <Field label="تكرار القسط">
                  <span className="text-[14px] font-bold text-slate-900">
                    {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency}
                  </span>
                </Field>
                <Field label="قاعدة البدء">
                  <span className="text-[14px] font-bold text-slate-900">
                    {START_DATE_RULE_LABELS[plan.startDateRule] ?? plan.startDateRule}
                  </span>
                </Field>
                {plan.manualStartDate && (
                  <Field label="تاريخ البدء">
                    <span className="text-[14px] font-bold text-slate-900">
                      {formatDate(plan.manualStartDate)}
                    </span>
                  </Field>
                )}
                {plan.finalPaymentAmount && Number(plan.finalPaymentAmount) > 0 && (
                  <Field label="الدفعة الأخيرة">
                    <span className="text-[14px] font-bold tabular-nums text-slate-900">
                      {formatCurrency(plan.finalPaymentAmount)}
                    </span>
                  </Field>
                )}
              </div>
            </PremiumSectionCard>

            {/* Duration options or schedule table */}
            {hasDurationOptions ? (
              <PremiumSectionCard title={`خيارات مدة التقسيط (${durationOptions.length})`}>
                <DurationSelector
                  options={durationOptions}
                  netPrice={Number(plan.netPrice)}
                  reservationAmount={Number(plan.reservationAmount)}
                  downPaymentAmount={Number(plan.downPaymentAmount)}
                  totalPrice={Number(plan.totalPrice)}
                />
              </PremiumSectionCard>
            ) : (
              <PremiumSectionCard
                title={`جدول السداد (${scheduleItems.length} دفعة)`}
                padded={false}
              >
                {scheduleItems.length === 0 ? (
                  <p className="text-sm text-slate-400 p-5">لا يوجد جدول سداد محفوظ لهذه الخطة.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-canvas/50 border-b border-hairline">
                        <tr>
                          <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">#</th>
                          <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">نوع الدفعة</th>
                          <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">تاريخ الاستحقاق</th>
                          <th className="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">المبلغ</th>
                          <th className="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">الرصيد المتبقي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {scheduleItems.map((item) => (
                          <tr key={item.id} className="hover:bg-canvas/40 transition-colors duration-100">
                            <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums font-mono">
                              {item.paymentNumber}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PAYMENT_TYPE_BADGE[item.paymentType]}`}>
                                {PAYMENT_TYPE_LABELS[item.paymentType]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[12px] text-slate-600">
                              {item.dueDate ? formatDate(item.dueDate) : '—'}
                            </td>
                            <td className="px-4 py-3 text-end text-[13px] font-bold tabular-nums text-slate-900">
                              {formatCurrency(item.amount)}
                            </td>
                            <td className="px-4 py-3 text-end text-[12px] text-slate-400 tabular-nums">
                              {formatCurrency(item.remainingBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-canvas/50 border-t-2 border-hairline">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-[13px] font-bold text-slate-700">
                            الإجمالي
                          </td>
                          <td className="px-4 py-3 text-end text-[13px] font-bold text-slate-900 tabular-nums">
                            {formatCurrency(
                              scheduleItems.reduce((s, i) => s + Number(i.amount), 0),
                            )}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </PremiumSectionCard>
            )}
          </div>
        }
        side={
          <div className="space-y-5">
            {isAdmin && (
              <PremiumCommandPanel title="إجراءات">
                {plan.status !== 'ACTIVE' && (
                  <div className="px-1">
                    <PlanDetailActions planId={plan.id} action="activate" />
                  </div>
                )}
                {plan.status === 'ACTIVE' && (
                  <div className="px-1">
                    <PlanDetailActions planId={plan.id} action="deactivate" />
                  </div>
                )}
                <Link href={`/dashboard/installments/${id}/edit`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Pencil /></span>
                  تعديل الخطة
                </Link>
                <Link href="/dashboard/installments" className={CMD_LINK}>
                  <span className={CMD_ICON}><ChevronLeft /></span>
                  قائمة خطط التقسيط
                </Link>
              </PremiumCommandPanel>
            )}

            {!isAdmin && (
              <PremiumCommandPanel title="التنقل">
                <Link href="/dashboard/installments" className={CMD_LINK}>
                  <span className={CMD_ICON}><ChevronLeft /></span>
                  قائمة خطط التقسيط
                </Link>
              </PremiumCommandPanel>
            )}

            {/* Status and scope */}
            <PremiumSectionCard title="الحالة والصلاحية" padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow label="الحالة">
                  <PlanTemplateStatusBadge status={plan.status} />
                </SideRow>
                <SideRow label="الصلاحية">
                  <span className="text-[11px] font-semibold bg-canvas text-slate-600 rounded-full px-2.5 py-0.5 border border-hairline">
                    مبيعات فقط
                  </span>
                </SideRow>
              </div>
            </PremiumSectionCard>

            {/* Project and unit */}
            <PremiumSectionCard title="المشروع والوحدة">
              <div className="space-y-4">
                {plan.project && (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                      <Building2 />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">المشروع</p>
                      <p className="text-[13.5px] font-bold text-slate-900 truncate">{tx(plan.project.name)}</p>
                    </div>
                  </div>
                )}
                {plan.unit ? (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                      <Home />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">الوحدة</p>
                      <p className="text-[13.5px] font-bold text-slate-900">{plan.unit.code}</p>
                      {plan.unit.type && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{plan.unit.type}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-400">تنطبق على كامل المشروع</p>
                )}
              </div>
            </PremiumSectionCard>

            {/* Creation info */}
            <PremiumSectionCard title="معلومات الإنشاء" padded={false}>
              <div className="divide-y divide-hairline">
                {plan.createdBy && (
                  <SideRow label="أنشئ بواسطة">
                    <span className="text-[12px] font-semibold text-slate-800">{plan.createdBy.fullName}</span>
                  </SideRow>
                )}
                <SideRow label="تاريخ الإنشاء">
                  <span className="text-[12px] font-medium text-slate-700">{formatDateTime(plan.createdAt)}</span>
                </SideRow>
                <SideRow label="آخر تعديل">
                  <span className="text-[12px] font-medium text-slate-700">{formatDateTime(plan.updatedAt)}</span>
                </SideRow>
              </div>
            </PremiumSectionCard>
          </div>
        }
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <p className="text-[12px] font-medium text-slate-500 shrink-0">{label}</p>
      <div className="text-end shrink-0">{children}</div>
    </div>
  );
}
