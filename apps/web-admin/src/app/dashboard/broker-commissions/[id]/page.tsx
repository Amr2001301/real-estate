import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Briefcase,
  UserCircle,
  Building2,
  Home,
  Banknote,
  FileText,
  CalendarRange,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerCommission } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BrokerCommissionStatusBadge,
  BrokerStatusBadge,
} from '@/components/badges';
import {
  ApproveCommissionForm,
  RejectCommissionForm,
  CancelCommissionForm,
} from './_review-forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function InfoRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5" dir={dir}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

export default async function AdminBrokerCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<AdminBrokerCommission>(`/broker-commissions/${id}`));
  if (r.error || !r.data) notFound();
  const c = r.data;

  const canApprove = c.status === 'PENDING' || c.status === 'REJECTED';
  const canReject = c.status === 'PENDING' || c.status === 'APPROVED';
  const canCancel = c.status !== 'CANCELLED';

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.commissionNumber}
        description={`عمولة العقد ${c.contract?.contractNumber ?? '—'}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'عمولات الوسطاء', href: '/dashboard/broker-commissions' },
          { label: c.commissionNumber },
        ]}
        meta={<BrokerCommissionStatusBadge status={c.status} />}
        actions={
          <Link href="/dashboard/broker-commissions">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      {c.status === 'REJECTED' && c.rejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{c.rejectionReason}</p>
            {c.rejectedBy && (
              <p className="text-2xs text-slate-500 mt-1">
                بواسطة {c.rejectedBy.fullName} • {formatDateTime(c.rejectedAt)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            الوسيط
          </h2>
          {c.broker ? (
            <>
              <Link
                href={`/dashboard/brokers/${c.broker.id}` as never}
                className="font-semibold text-slate-900 hover:text-brand-700"
              >
                {c.broker.companyName}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <BrokerStatusBadge status={c.broker.status} />
                <span className="font-mono text-2xs text-slate-500" dir="ltr">
                  {c.broker.code}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
          {c.brokerAgent && (
            <div className="mt-3 pt-3 border-t border-hairline">
              <p className="text-xs text-slate-500">جهة الاتصال</p>
              <p className="text-sm text-slate-800 mt-0.5">{c.brokerAgent.fullName}</p>
              <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                {c.brokerAgent.email ?? c.brokerAgent.phone ?? '—'}
              </p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">العقد والحجز</h2>
          <InfoRow
            icon={<FileText />}
            label="رقم العقد"
            value={
              c.contract ? (
                <Link
                  href={`/dashboard/contracts/${c.contract.id}` as never}
                  className="font-mono text-brand-700 hover:text-brand-800"
                  dir="ltr"
                >
                  {c.contract.contractNumber ?? '—'}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <InfoRow
            icon={<FileText />}
            label="رقم الحجز"
            value={
              c.reservation ? (
                <Link
                  href={`/dashboard/reservations/${c.reservation.id}` as never}
                  className="font-mono text-brand-700 hover:text-brand-800"
                  dir="ltr"
                >
                  {c.reservation.reservationNumber ?? '—'}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <InfoRow
            icon={<UserCircle />}
            label="العميل"
            value={c.contract?.customer?.fullName ?? c.reservation?.lead?.fullName}
          />
          <InfoRow
            icon={<UserCircle />}
            label="المندوب الداخلي"
            value={c.reservation?.sales?.fullName ?? '—'}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">الوحدة والمشروع</h2>
          <InfoRow
            icon={<Building2 />}
            label="المشروع"
            value={c.project ? tx(c.project.name) : '—'}
          />
          <InfoRow
            icon={<Home />}
            label="الوحدة"
            value={
              c.unit ? (
                <span className="font-mono" dir="ltr">
                  {c.unit.code} • {c.unit.type}
                </span>
              ) : (
                '—'
              )
            }
          />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الاستحقاق"
            value={formatDate(c.earnedAt)}
          />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-600" />
          الحساب
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">قيمة الأساس</p>
            <p className="font-medium mt-1 text-slate-900 tabular-nums">
              {formatCurrency(c.basisAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">النسبة</p>
            <p className="font-medium mt-1 text-slate-900">
              {c.commissionPct !== null && c.commissionPct !== undefined
                ? `${Number(c.commissionPct).toFixed(2)}%`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">الإجمالي قبل الخصم</p>
            <p className="font-medium mt-1 text-slate-900 tabular-nums">
              {formatCurrency(c.grossAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">الضريبة</p>
            <p className="font-medium mt-1 text-slate-900 tabular-nums">
              {Number(c.taxPct).toFixed(2)}% • {formatCurrency(c.taxAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">حجز ضريبي</p>
            <p className="font-medium mt-1 text-slate-900 tabular-nums">
              {Number(c.withholdingPct).toFixed(2)}% •{' '}
              {formatCurrency(c.withholdingAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3 lg:col-span-2 bg-emerald-50/30">
            <p className="text-xs text-slate-500">الصافي المستحق</p>
            <p className="font-semibold mt-1 text-emerald-700 tabular-nums">
              {formatCurrency(c.netAmount)}
            </p>
          </div>
        </div>
      </Card>

      {(canApprove || canReject || canCancel) && c.status !== 'CANCELLED' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {canApprove && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">اعتماد</h3>
              <ApproveCommissionForm id={c.id} />
            </Card>
          )}
          {canReject && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">رفض</h3>
              <RejectCommissionForm id={c.id} />
            </Card>
          )}
          {canCancel && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">إلغاء</h3>
              <CancelCommissionForm id={c.id} />
            </Card>
          )}
        </div>
      )}

      {c.notes && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">الملاحظات</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {c.notes}
          </p>
        </Card>
      )}

      {c.approvedBy && c.status === 'APPROVED' && (
        <Card className="p-5 bg-green-50/40 border-green-100">
          <p className="text-sm text-green-700">
            معتمدة بواسطة {c.approvedBy.fullName} •{' '}
            {formatDateTime(c.approvedAt)}
          </p>
        </Card>
      )}
    </div>
  );
}
