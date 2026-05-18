import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  UserCircle,
  Building2,
  Home,
  Banknote,
  FileText,
  CalendarRange,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalCommission } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrokerCommissionStatusBadge } from '@/components/badges';

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

export default async function PortalCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalCommission>(`/portal/commissions/${id}`));
  if (r.error || !r.data) notFound();
  const c = r.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.commissionNumber}
        description={`عمولة من العقد ${c.contract?.contractNumber ?? '—'}`}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العمولات', href: '/portal/commissions' },
          { label: c.commissionNumber },
        ]}
        meta={<BrokerCommissionStatusBadge status={c.status} />}
        actions={
          <Link href="/portal/commissions">
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
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">العقد والحجز</h2>
          <InfoRow
            icon={<FileText />}
            label="رقم العقد"
            value={
              c.contract ? (
                <Link
                  href={`/portal/contracts/${c.contract.id}` as never}
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
                  href={`/portal/reservations/${c.reservation.id}` as never}
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
            icon={<Banknote />}
            label="سعر الوحدة"
            value={c.unit ? formatCurrency(c.unit.price) : '—'}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">الزمن</h2>
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الاستحقاق"
            value={formatDate(c.earnedAt)}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الاعتماد"
            value={c.approvedAt ? formatDate(c.approvedAt) : '—'}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الإنشاء"
            value={formatDate(c.createdAt)}
          />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-600" />
          تفاصيل الحساب
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">الأساس (Basis)</p>
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
            <p className="text-xs text-slate-500">الإجمالي (Gross)</p>
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
            <p className="text-xs text-slate-500">الصافي (Net)</p>
            <p className="font-semibold mt-1 text-emerald-700 tabular-nums">
              {formatCurrency(c.netAmount)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-2xs text-slate-500">
          تم تثبيت هذه الأرقام عند توقيع العقد. لا تتغير بعد ذلك.
        </p>
      </Card>
    </div>
  );
}
