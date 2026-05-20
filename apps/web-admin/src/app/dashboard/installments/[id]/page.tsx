import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Building2, Home, Calendar, User } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { InstallmentPlanTemplate, PlanPaymentType } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlanTemplateStatusBadge } from '@/components/badges';
import { PlanDetailActions } from '../_components/plan-detail-actions';
import { DurationSelector } from './_components/duration-selector';

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
    <div className="space-y-6 pb-2">
      <PageHeader
        title={plan.name}
        description={plan.description ?? 'خطة تقسيط'}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'خطط التقسيط', href: '/dashboard/installments' },
          { label: plan.name },
        ]}
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Plan info */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الخطة</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500 mb-0.5">صافي السعر</dt>
                  <dd className="font-bold text-slate-900 text-base">{formatCurrency(plan.netPrice)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">السعر الإجمالي</dt>
                  <dd className="font-medium">{formatCurrency(plan.totalPrice)}</dd>
                </div>
                {Number(plan.discountAmount) > 0 && (
                  <div>
                    <dt className="text-slate-500 mb-0.5">الخصم</dt>
                    <dd className="font-medium text-green-700">- {formatCurrency(plan.discountAmount)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500 mb-0.5">دفعة الحجز</dt>
                  <dd
                    className={
                      Number(plan.reservationAmount) > 0
                        ? 'font-medium'
                        : 'font-medium text-warning-700'
                    }
                  >
                    {formatCurrency(plan.reservationAmount)}
                    {Number(plan.reservationAmount) <= 0 && (
                      <span className="text-xs text-warning-700 ms-2">
                        ⚠ يجب تحديد دفعة الحجز قبل استخدام الخطة لإنشاء حجز
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">الدفعة الأولى</dt>
                  <dd className="font-medium">
                    {formatCurrency(plan.downPaymentAmount)}
                    {plan.downPaymentType === 'PERCENTAGE' && (
                      <span className="text-xs text-slate-500 ms-1">
                        ({Number(plan.downPaymentValue)}%)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">{hasDurationOptions ? 'خيارات المدة' : 'عدد الأقساط'}</dt>
                  <dd className="font-medium">
                    {hasDurationOptions
                      ? `${durationOptions.length} خيار`
                      : plan.installmentsCount != null
                        ? `${plan.installmentsCount} قسط`
                        : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">تكرار القسط</dt>
                  <dd className="font-medium">{FREQUENCY_LABELS[plan.frequency] ?? plan.frequency}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">قاعدة البدء</dt>
                  <dd className="font-medium">{START_DATE_RULE_LABELS[plan.startDateRule] ?? plan.startDateRule}</dd>
                </div>
                {plan.manualStartDate && (
                  <div>
                    <dt className="text-slate-500 mb-0.5">تاريخ البدء</dt>
                    <dd className="font-medium">{formatDate(plan.manualStartDate)}</dd>
                  </div>
                )}
                {plan.finalPaymentAmount && Number(plan.finalPaymentAmount) > 0 && (
                  <div>
                    <dt className="text-slate-500 mb-0.5">الدفعة الأخيرة</dt>
                    <dd className="font-medium">{formatCurrency(plan.finalPaymentAmount)}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {/* Duration options or legacy schedule */}
          {hasDurationOptions ? (
            <Card>
              <CardHeader>
                <CardTitle>خيارات مدة التقسيط ({durationOptions.length})</CardTitle>
              </CardHeader>
              <CardBody>
                <DurationSelector
                  options={durationOptions}
                  netPrice={Number(plan.netPrice)}
                  reservationAmount={Number(plan.reservationAmount)}
                  downPaymentAmount={Number(plan.downPaymentAmount)}
                  totalPrice={Number(plan.totalPrice)}
                />
              </CardBody>
            </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>جدول السداد ({scheduleItems.length} دفعة)</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {scheduleItems.length === 0 ? (
                <p className="text-sm text-slate-400 p-5">لا يوجد جدول سداد محفوظ لهذه الخطة.</p>
              ) : (
                <div className="overflow-x-auto">
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
                      {scheduleItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 tabular-nums">{item.paymentNumber}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_TYPE_BADGE[item.paymentType]}`}
                            >
                              {PAYMENT_TYPE_LABELS[item.paymentType]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {item.dueDate ? formatDate(item.dueDate) : '—'}
                          </td>
                          <td className="px-4 py-3 text-end font-medium tabular-nums">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="px-4 py-3 text-end text-slate-500 tabular-nums text-xs">
                            {formatCurrency(item.remainingBalance)}
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
            </CardBody>
          </Card>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>الحالة والصلاحية</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الحالة</span>
                  <PlanTemplateStatusBadge status={plan.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الصلاحية</span>
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                    مبيعات فقط
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Project / Unit */}
          <Card>
            <CardHeader>
              <CardTitle>المشروع والوحدة</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3 text-sm">
                {plan.project && (
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-500 text-xs">المشروع</p>
                      <p className="font-medium">{tx(plan.project.name)}</p>
                    </div>
                  </div>
                )}
                {plan.unit ? (
                  <div className="flex items-start gap-2">
                    <Home className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-500 text-xs">الوحدة</p>
                      <p className="font-medium">{plan.unit.code}</p>
                      {plan.unit.type && <p className="text-xs text-slate-500">{plan.unit.type}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">تنطبق على كامل المشروع</p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>معلومات الإنشاء</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3 text-sm">
                {plan.createdBy && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-500 text-xs">أنشئ بواسطة</p>
                      <p className="font-medium">{plan.createdBy.fullName}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500 text-xs">تاريخ الإنشاء</p>
                    <p className="font-medium">{formatDateTime(plan.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500 text-xs">آخر تعديل</p>
                    <p className="font-medium">{formatDateTime(plan.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
