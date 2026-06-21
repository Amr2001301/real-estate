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
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Contract } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
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
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 hover:bg-white/[0.07] hover:text-white/95 transition-colors';
const CMD_ICON =
  'h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/[0.08] text-brand-300 shrink-0 [&_svg]:h-4 [&_svg]:w-4';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 mb-0.5">رقم العقد</dt>
                  <dd className="font-mono font-semibold text-brand-700">{displayNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-0.5">إجمالي العقد</dt>
                  <dd className="font-semibold">{formatCurrency(contract.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-0.5">الدفعة المقدمة</dt>
                  <dd className="font-semibold">{formatCurrency(contract.downPayment)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-0.5">تاريخ التوقيع</dt>
                  <dd>
                    {contract.signedAt ? (
                      formatDateTime(contract.signedAt)
                    ) : (
                      <span className="text-slate-400">غير موقّع</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-0.5">تاريخ الإنشاء</dt>
                  <dd>{formatDateTime(contract.createdAt)}</dd>
                </div>
              </dl>
            </PremiumSectionCard>

            {/* Source reservation */}
            {contract.reservation && (
              <PremiumSectionCard title="محوّل من حجز" icon={<Link2 />}>
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    هذا العقد تم إنشاؤه تلقائياً من تحويل حجز.
                  </p>
                  <Link
                    href={`/dashboard/reservations/${contract.reservation.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:underline"
                  >
                    <Link2 className="h-4 w-4" />
                    {contract.reservation.reservationNumber ??
                      contract.reservation.id.slice(0, 8)}
                  </Link>
                </div>
              </PremiumSectionCard>
            )}

            {/* Broker attribution */}
            {contract.broker && (
              <PremiumSectionCard title="الوسيط">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">شركة الوساطة</p>
                    <Link
                      href={`/dashboard/brokers/${contract.broker.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {contract.broker.companyName}
                      {contract.broker.commercialName && (
                        <span className="text-slate-500 font-normal">
                          {' '}— {contract.broker.commercialName}
                        </span>
                      )}
                    </Link>
                    <p className="text-2xs text-slate-500 font-mono mt-0.5" dir="ltr">
                      {contract.broker.code}
                    </p>
                  </div>
                  {contract.brokerAgent && (
                    <div>
                      <p className="text-xs text-slate-500">جهة الاتصال</p>
                      <p className="text-sm text-slate-800">{contract.brokerAgent.fullName}</p>
                      <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                        {contract.brokerAgent.email ?? contract.brokerAgent.phone ?? '—'}
                      </p>
                    </div>
                  )}
                  {contract.reservation &&
                    (contract.reservation.commissionLockedPct !== null ||
                      contract.reservation.commissionLockedAmount !== null) && (
                      <div className="rounded-xl bg-canvas/60 px-3 py-2.5 text-xs text-slate-700">
                        <p className="text-2xs text-slate-500 mb-1">
                          لقطة العمولة (من الحجز)
                        </p>
                        {contract.reservation.commissionLockedPct !== null &&
                          contract.reservation.commissionLockedPct !== undefined && (
                            <p>
                              النسبة:{' '}
                              {Number(contract.reservation.commissionLockedPct).toFixed(2)}%
                            </p>
                          )}
                        {contract.reservation.commissionLockedAmount !== null &&
                          contract.reservation.commissionLockedAmount !== undefined && (
                            <p className="mt-0.5">
                              المبلغ:{' '}
                              {String(contract.reservation.commissionLockedAmount)}
                            </p>
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
                  <div className="px-5 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-hairline text-sm">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">عدد الأقساط</p>
                      <p className="font-semibold">{plan.totalMonths} شهر</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">القسط الشهري</p>
                      <p className="font-semibold">{formatCurrency(plan.monthlyAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">تاريخ البدء</p>
                      <p className="font-semibold">{formatDate(plan.startsAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">التكرار</p>
                      <p className="font-semibold">
                        {FREQ_LABELS[plan.frequency] ?? plan.frequency}
                      </p>
                    </div>
                  </div>

                  {/* Installments table */}
                  {plan.installments && plan.installments.length > 0 && (
                    <div className="overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                          <tr>
                            <th className="px-5 py-2.5 text-start">#</th>
                            <th className="px-4 py-2.5 text-start">النوع</th>
                            <th className="px-4 py-2.5 text-start whitespace-nowrap">
                              تاريخ الاستحقاق
                            </th>
                            <th className="px-4 py-2.5 text-start">المبلغ</th>
                            <th className="px-4 py-2.5 text-start">الحالة</th>
                            <th className="px-4 py-2.5 text-start whitespace-nowrap">
                              تاريخ الدفع
                            </th>
                            <th className="px-4 py-2.5 text-start" />
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
                                  <td className="px-5 py-2.5 text-slate-500 font-mono text-xs">
                                    {isInstallment ? rowLabel : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-slate-600">
                                    {PAYMENT_TYPE_LABELS[inst.type] ?? 'قسط'}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {formatDate(inst.dueDate)}
                                  </td>
                                  <td className="px-4 py-2.5 font-semibold tabular-nums">
                                    {formatCurrency(inst.amount)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}
                                    >
                                      {s.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-400 text-xs">
                                    {inst.paidAt ? formatDate(inst.paidAt) : '—'}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {canPay && (
                                      <RecordPaymentButton
                                        contractId={contract.id}
                                        installmentId={inst.id}
                                        amount={inst.amount}
                                        dueDate={inst.dueDate}
                                        installmentType={inst.type}
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
                          className="rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                        <input
                          name="monthlyAmount"
                          type="number"
                          step="any"
                          min={0}
                          placeholder="القسط الشهري"
                          required
                          className="rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                        <input
                          name="startsAt"
                          type="date"
                          required
                          className="rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
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
                    <Button variant="secondary" size="sm" type="button">
                      + تسجيل دفعة
                    </Button>
                  </Link>
                ) : undefined
              }
              padded={false}
            >
              {contract.deposits && contract.deposits.length > 0 ? (
                <ul className="divide-y divide-hairline text-sm">
                  {contract.deposits.map((d) => (
                    <li
                      key={d.id}
                      className="px-5 sm:px-6 py-3 flex justify-between items-center hover:bg-canvas/40 transition-colors duration-100"
                    >
                      {isAdmin ? (
                        <Link
                          href={`/dashboard/deposits/${d.id}`}
                          className="font-semibold tabular-nums text-brand-700 hover:text-brand-800"
                        >
                          {formatCurrency(d.amount)}
                        </Link>
                      ) : (
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(d.amount)}
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs">{formatDate(d.paidAt)}</span>
                        {d.receiptUrl && (
                          <a
                            href={d.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:underline text-xs"
                          >
                            إيصال
                          </a>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            d.verified
                              ? 'bg-success-100 text-success-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {d.verified ? 'متحقق' : 'غير متحقق'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
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
              <div className="flex flex-col gap-0.5">
                {contract.customer && (
                  <Link
                    href={`/dashboard/customers/${contract.customer.id}`}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><User /></span>
                    <span>عرض العميل</span>
                  </Link>
                )}
                {contract.unit && (
                  <Link
                    href={`/dashboard/units/${contract.unit.id}`}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><Building2 /></span>
                    <span>عرض الوحدة</span>
                  </Link>
                )}
                {contract.reservation && (
                  <Link
                    href={`/dashboard/reservations/${contract.reservation.id}`}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><Link2 /></span>
                    <span>الحجز المرتبط</span>
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href={`/dashboard/deposits/new?contractId=${contract.id}`}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><CreditCard /></span>
                    <span>تسجيل دفعة</span>
                  </Link>
                )}
              </div>
            </PremiumCommandPanel>

            {/* Customer */}
            <PremiumSectionCard title="العميل" icon={<User />}>
              {contract.customer ? (
                <div className="space-y-1.5 text-sm">
                  <Link
                    href={`/dashboard/customers/${contract.customer.id}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {contract.customer.fullName}
                  </Link>
                  {contract.customer.phone && (
                    <p className="text-slate-500 text-xs" dir="ltr">
                      {contract.customer.phone}
                    </p>
                  )}
                  {(contract.customer as { email?: string | null }).email && (
                    <p className="text-slate-500 text-xs">
                      {(contract.customer as { email?: string | null }).email}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </PremiumSectionCard>

            {/* Unit */}
            <PremiumSectionCard title="الوحدة" icon={<Building2 />}>
              {contract.unit ? (
                <div className="space-y-1 text-sm">
                  <Link
                    href={`/dashboard/units/${contract.unit.id}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {contract.unit.code}
                  </Link>
                  <p className="text-slate-500 text-xs">{contract.unit.type}</p>
                  <p className="text-slate-500 text-xs">{projectName}</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">—</p>
              )}
            </PremiumSectionCard>

            {/* Financial summary */}
            <PremiumSectionCard title="ملخص مالي">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">الإجمالي</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(contract.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الدفعة المقدمة</span>
                  <span className="tabular-nums">
                    {formatCurrency(contract.downPayment)}
                  </span>
                </div>
                {plan && (
                  <>
                    <div className="border-t border-hairline pt-2 flex justify-between">
                      <span className="text-slate-500">عدد الأقساط</span>
                      <span className="tabular-nums">{plan.totalMonths}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">القسط الشهري</span>
                      <span className="tabular-nums">
                        {formatCurrency(plan.monthlyAmount)}
                      </span>
                    </div>
                  </>
                )}
                {contract.signedAt ? (
                  <div className="flex items-center gap-1.5 text-success-700 text-xs pt-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    موقّع {formatDate(contract.signedAt)}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs pt-1">
                    <Clock className="h-3.5 w-3.5" />
                    في انتظار التوقيع
                  </div>
                )}
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
