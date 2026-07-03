import Link from 'next/link';
import {
  FileText,
  User,
  Building2,
  Link2,
  CheckCircle2,
  Clock,
  CalendarDays,
  CreditCard,
  AlertCircle,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Contract } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ContractPdfPanel } from './pdf-panel';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import { createInstallmentPlanAction } from '../actions';
import { RecordPaymentButton } from './record-payment-button';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  SEMI_ANNUAL: 'نصف سنوي',
  YEARLY: 'سنوي',
};

const INST_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'قيد الانتظار', cls: 'bg-slate-100 text-slate-600' },
  PAID: { label: 'مدفوع', cls: 'bg-success-100 text-success-700' },
  OVERDUE: { label: 'متأخر', cls: 'bg-danger-100 text-danger-700' },
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  RESERVATION: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

const CMD_LINK =
  'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currency = await getReportsCurrency();
  const r = await safe(api.get<Contract>(`/contracts/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
        {r.error ?? 'لم يتم العثور على العقد'}
      </div>
    );
  }

  const contract = r.data;
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const plan = contract.installmentPlan;
  const projectName =
    tx(contract.unit?.building?.phase?.project?.name) || '—';
  const displayNumber = contract.contractNumber ?? contract.id.slice(0, 8);
  const customerEmail = (contract.customer as { email?: string | null } | undefined)?.email;

  return (
    <div className="space-y-5 pb-2">
      <PremiumPageHero
        title={`عقد ${displayNumber}`}
        description={`${contract.customer?.fullName ?? '—'} · الوحدة ${contract.unit?.code ?? '—'} · ${projectName}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العقود', href: '/dashboard/contracts' },
          { label: displayNumber },
        ]}
        meta={
          contract.signedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-success-700 bg-success-50 px-2.5 py-1 rounded-full border border-success-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              موقّع · {formatDate(contract.signedAt)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              في انتظار التوقيع
            </span>
          )
        }
      />

      <PremiumDetailLayout
        main={
          <>
            {/* Contract key info */}
            <PremiumSectionCard title="بيانات العقد" icon={<FileText />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="رقم العقد">
                  <span className="font-mono text-[15px] font-bold text-brand-700">{displayNumber}</span>
                </Field>
                <Field label="إجمالي العقد">
                  <span className="text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(contract.totalAmount, currency)}</span>
                </Field>
                <Field label="الدفعة المقدمة">
                  <span className="text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(contract.downPayment, currency)}</span>
                </Field>
                <Field label="تاريخ التوقيع">
                  {contract.signedAt ? (
                    <span className="text-[13px] font-semibold text-success-700">{formatDateTime(contract.signedAt)}</span>
                  ) : (
                    <span className="text-[13px] text-slate-400">غير موقّع</span>
                  )}
                </Field>
                <Field label="تاريخ الإنشاء">
                  <span className="text-[13px] font-semibold text-slate-800">{formatDateTime(contract.createdAt)}</span>
                </Field>
              </div>
            </PremiumSectionCard>

            {/* Source reservation */}
            {contract.reservation && (
              <PremiumSectionCard title="محوّل من حجز" icon={<Link2 />}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 [&_svg]:h-5 [&_svg]:w-5">
                    <Link2 />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 mb-1">
                      تم إنشاء هذا العقد تلقائياً من تحويل حجز
                    </p>
                    <Link
                      href={`/dashboard/reservations/${contract.reservation.id}`}
                      className="font-mono text-[14px] font-bold text-indigo-700 hover:underline"
                    >
                      {contract.reservation.reservationNumber ??
                        contract.reservation.id.slice(0, 8)}
                    </Link>
                  </div>
                </div>
              </PremiumSectionCard>
            )}

            {/* Broker attribution */}
            {contract.broker && (
              <PremiumSectionCard title="الوسيط" icon={<Building2 />}>
                <div className="space-y-5">
                  <Field label="شركة الوساطة">
                    <Link
                      href={`/dashboard/brokers/${contract.broker.id}`}
                      className="text-[13.5px] font-bold text-brand-700 hover:underline"
                    >
                      {contract.broker.companyName}
                    </Link>
                    {contract.broker.commercialName && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{contract.broker.commercialName}</p>
                    )}
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5" dir="ltr">
                      {contract.broker.code}
                    </p>
                  </Field>
                  {contract.brokerAgent && (
                    <Field label="جهة الاتصال">
                      <p className="text-[13px] font-semibold text-slate-800">{contract.brokerAgent.fullName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5" dir="ltr">
                        {contract.brokerAgent.email ?? contract.brokerAgent.phone ?? '—'}
                      </p>
                    </Field>
                  )}
                  {contract.reservation &&
                    (contract.reservation.commissionLockedPct !== null ||
                      contract.reservation.commissionLockedAmount !== null) && (
                      <div className="rounded-xl bg-canvas/60 border border-hairline px-4 py-3 text-xs text-slate-700 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
                          لقطة العمولة (من الحجز)
                        </p>
                        {contract.reservation.commissionLockedPct !== null &&
                          contract.reservation.commissionLockedPct !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">النسبة</span>
                              <span className="font-semibold tabular-nums">
                                {Number(contract.reservation.commissionLockedPct).toFixed(2)}%
                              </span>
                            </div>
                          )}
                        {contract.reservation.commissionLockedAmount !== null &&
                          contract.reservation.commissionLockedAmount !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">المبلغ</span>
                              <span className="font-semibold tabular-nums">
                                {String(contract.reservation.commissionLockedAmount)}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              </PremiumSectionCard>
            )}

            {/* Installment plan */}
            <PremiumSectionCard
              title="خطة التقسيط"
              icon={<CalendarDays />}
              padded={!plan}
            >
              {plan ? (
                <div>
                  {/* Summary bar */}
                  <div className="px-5 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-b border-hairline">
                    <Field label="عدد الأقساط">
                      <span className="text-[14px] font-bold tabular-nums text-slate-900">{plan.totalMonths} شهر</span>
                    </Field>
                    <Field label="القسط الشهري">
                      <span className="text-[14px] font-bold tabular-nums text-slate-900">{formatCurrency(plan.monthlyAmount, currency)}</span>
                    </Field>
                    <Field label="تاريخ البدء">
                      <span className="text-[14px] font-bold text-slate-900">{formatDate(plan.startsAt)}</span>
                    </Field>
                    <Field label="التكرار">
                      <span className="text-[14px] font-bold text-slate-900">{FREQ_LABELS[plan.frequency] ?? plan.frequency}</span>
                    </Field>
                  </div>

                  {/* Installments table */}
                  {plan.installments && plan.installments.length > 0 && (
                    <div className="overflow-auto max-h-[420px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-canvas/60 backdrop-blur-sm border-b border-hairline">
                          <tr>
                            <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">#</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">النوع</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">تاريخ الاستحقاق</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">المبلغ</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">الحالة</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">تاريخ الدفع</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {(() => {
                            let installmentCounter = 0;
                            return plan.installments!.map((inst) => {
                              const s =
                                INST_STATUS[inst.status] ?? INST_STATUS['PENDING']!;
                              const canPay =
                                isAdmin &&
                                (inst.status === 'PENDING' || inst.status === 'OVERDUE');
                              const isInstallment =
                                !inst.type || inst.type === 'INSTALLMENT';
                              if (isInstallment) installmentCounter++;
                              const rowLabel = isInstallment
                                ? String(installmentCounter)
                                : PAYMENT_TYPE_LABELS[inst.type] ?? inst.type;
                              return (
                                <tr
                                  key={inst.id}
                                  className="hover:bg-canvas/40 transition-colors duration-100"
                                >
                                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">
                                    {isInstallment ? rowLabel : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                                    {PAYMENT_TYPE_LABELS[inst.type] ?? 'قسط'}
                                  </td>
                                  <td className="px-4 py-3 text-[13px] text-slate-700">
                                    {formatDate(inst.dueDate)}
                                  </td>
                                  <td className="px-4 py-3 text-[13px] font-bold tabular-nums text-slate-900">
                                    {formatCurrency(inst.amount, currency)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn('inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold', s.cls)}>
                                      {s.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[12px] text-slate-400">
                                    {inst.paidAt ? formatDate(inst.paidAt) : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    {canPay && (
                                      <RecordPaymentButton
                                        contractId={contract.id}
                                        installmentId={inst.id}
                                        amount={inst.amount}
                                        dueDate={inst.dueDate}
                                        installmentType={inst.type}
                                        currency={currency}
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {contract.reservationId ? (
                    <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>
                        هذا العقد تم إنشاؤه من حجز ولكن بدون خطة تقسيط. تحقق من
                        الحجز الأصلي أو قم بإصلاح البيانات يدوياً. استخدم النموذج
                        أدناه لإضافة الخطة (للمسؤول فقط).
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      لا توجد خطة تقسيط لهذا العقد. يمكنك إنشاؤها يدوياً أدناه.
                    </p>
                  )}
                  {isAdmin && (
                    <form
                      action={createInstallmentPlanAction.bind(null, contract.id)}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          name="totalMonths"
                          type="number"
                          min={1}
                          max={360}
                          placeholder="عدد الأشهر"
                          required
                          className="rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                        <input
                          name="monthlyAmount"
                          type="number"
                          step="any"
                          min={0}
                          placeholder="القسط الشهري"
                          required
                          className="rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                        <input
                          name="startsAt"
                          type="date"
                          required
                          className="rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                      </div>
                      <Button type="submit" variant="primary" size="sm">
                        إنشاء الخطة
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </PremiumSectionCard>

            {/* Deposits */}
            <PremiumSectionCard
              title="الدفعات المسجلة"
              icon={<CreditCard />}
              trailing={
                isAdmin ? (
                  <Link href={`/dashboard/deposits/new?contractId=${contract.id}`}>
                    <Button variant="secondary" size="sm" type="button" leftIcon={<CreditCard className="h-3.5 w-3.5" />}>
                      تسجيل دفعة
                    </Button>
                  </Link>
                ) : undefined
              }
              padded={false}
            >
              {contract.deposits && contract.deposits.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {contract.deposits.map((d) => (
                    <li
                      key={d.id}
                      className="px-5 sm:px-6 py-3.5 flex items-center gap-3 hover:bg-canvas/40 transition-colors duration-100"
                    >
                      <div className="min-w-0 flex-1">
                        {isAdmin ? (
                          <Link
                            href={`/dashboard/deposits/${d.id}`}
                            className="text-[15px] font-bold tabular-nums text-brand-700 hover:underline"
                          >
                            {formatCurrency(d.amount, currency)}
                          </Link>
                        ) : (
                          <span className="text-[15px] font-bold tabular-nums text-slate-900">
                            {formatCurrency(d.amount, currency)}
                          </span>
                        )}
                        <p className="text-[12px] text-slate-400 mt-0.5">{formatDate(d.paidAt)}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {d.receiptUrl && (
                          <a
                            href={d.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> إيصال
                          </a>
                        )}
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                            d.verified
                              ? 'bg-success-50 text-success-700'
                              : 'bg-amber-50 text-amber-700',
                          )}
                        >
                          {d.verified ? 'متحقق' : 'غير متحقق'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  لا توجد دفعات مسجلة
                </div>
              )}
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            {/* Quick navigation */}
            <PremiumCommandPanel title="إجراءات سريعة">
              {contract.customer && (
                <Link href={`/dashboard/customers/${contract.customer.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><User /></span>
                  <span>عرض العميل</span>
                </Link>
              )}
              {contract.unit && (
                <Link href={`/dashboard/units/${contract.unit.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Building2 /></span>
                  <span>عرض الوحدة</span>
                </Link>
              )}
              {contract.reservation && (
                <Link href={`/dashboard/reservations/${contract.reservation.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Link2 /></span>
                  <span>الحجز المرتبط</span>
                </Link>
              )}
              {isAdmin && (
                <Link href={`/dashboard/deposits/new?contractId=${contract.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><CreditCard /></span>
                  <span>تسجيل دفعة</span>
                </Link>
              )}
            </PremiumCommandPanel>

            {/* Customer */}
            <PremiumSectionCard title="العميل" icon={<User />}>
              {contract.customer ? (
                <div className="space-y-2.5">
                  <p className="text-[15px] font-bold text-slate-900">
                    {contract.customer.fullName}
                  </p>
                  {contract.customer.phone && (
                    <a
                      href={`tel:${contract.customer.phone}`}
                      className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <Phone />
                      </span>
                      <span className="text-sm font-medium text-slate-700" dir="ltr">
                        {contract.customer.phone}
                      </span>
                    </a>
                  )}
                  {customerEmail && (
                    <a
                      href={`mailto:${customerEmail}`}
                      className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <Mail />
                      </span>
                      <span className="text-sm font-medium text-slate-700 truncate" dir="ltr">
                        {customerEmail}
                      </span>
                    </a>
                  )}
                  <Link
                    href={`/dashboard/customers/${contract.customer.id}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    عرض ملف العميل
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </PremiumSectionCard>

            {/* Unit */}
            <PremiumSectionCard title="الوحدة" icon={<Building2 />}>
              {contract.unit ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/units/${contract.unit.id}`}
                      className="text-[16px] font-bold text-brand-700 hover:underline"
                    >
                      {contract.unit.code}
                    </Link>
                    {contract.unit.type && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-canvas px-2 py-0.5 rounded-lg border border-hairline">
                        {contract.unit.type}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500">{projectName}</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">—</p>
              )}
            </PremiumSectionCard>

            {/* Financial summary */}
            <PremiumSectionCard title="ملخص مالي" padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow label="الإجمالي">
                  <span className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(contract.totalAmount, currency)}
                  </span>
                </SideRow>
                <SideRow label="الدفعة المقدمة">
                  <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                    {formatCurrency(contract.downPayment, currency)}
                  </span>
                </SideRow>
                {plan && (
                  <>
                    <SideRow label="عدد الأقساط">
                      <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                        {plan.totalMonths} شهر
                      </span>
                    </SideRow>
                    <SideRow label="القسط الشهري">
                      <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                        {formatCurrency(plan.monthlyAmount, currency)}
                      </span>
                    </SideRow>
                  </>
                )}
                <SideRow label="حالة التوقيع">
                  {contract.signedAt ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      موقّع {formatDate(contract.signedAt)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      في انتظار التوقيع
                    </span>
                  )}
                </SideRow>
              </div>
            </PremiumSectionCard>

            {/* PDF panel */}
            <ContractPdfPanel contract={contract} />

            {/* Contract documents */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400 px-1">
                ارفع نسخة العقد الموقعة أو أي مرفقات قانونية مرتبطة بالعقد.
              </p>
              <OwnerDocumentsCard
                ownerType="CONTRACT"
                ownerId={contract.id}
                title="مستندات العقد"
                legacy={
                  contract.pdfUrl
                    ? [
                        {
                          label: 'ملف العقد الحالي',
                          href: contract.pdfUrl,
                          hint: 'رابط محفوظ في العقد',
                        },
                      ]
                    : undefined
                }
              />
            </div>
          </>
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
      <div className="text-end">{children}</div>
    </div>
  );
}
