import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FileText,
  ChevronLeft,
  Phone,
  Mail,
  Building2,
  Home,
  UserCircle,
  CalendarRange,
  Banknote,
  CheckCircle2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalContract } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

export default async function PortalContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalContract>(`/portal/contracts/${id}`));
  if (r.error || !r.data) notFound();
  const contract = r.data;
  const project = contract.unit?.building?.phase.project;

  return (
    <div className="space-y-5">
      <PageHeader
        title={contract.contractNumber ?? 'عقد'}
        description={project ? tx(project.name) : undefined}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العقود', href: '/portal/contracts' },
          { label: contract.contractNumber ?? id },
        ]}
        meta={
          <>
            {contract.signedAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" />
                موقع — {formatDate(contract.signedAt)}
              </span>
            ) : (
              <span className="inline-block rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                قيد التوقيع
              </span>
            )}
            {contract.reservation?.reservationNumber && (
              <span className="text-xs text-slate-600">
                من الحجز:{' '}
                <Link
                  href={`/portal/reservations/${contract.reservation.id}` as never}
                  className="font-mono text-brand-700 hover:text-brand-800 underline"
                  dir="ltr"
                >
                  {contract.reservation.reservationNumber}
                </Link>
              </span>
            )}
          </>
        }
        actions={
          <Link href="/portal/contracts">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">العميل</h2>
          <InfoRow
            icon={<UserCircle />}
            label="الاسم"
            value={contract.customer?.fullName ?? contract.reservation?.lead?.fullName}
          />
          <InfoRow
            icon={<Phone />}
            label="الجوال"
            value={contract.customer?.phone ?? contract.reservation?.lead?.phone}
            dir="ltr"
          />
          <InfoRow
            icon={<Mail />}
            label="البريد"
            value={contract.customer?.email}
            dir="ltr"
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">الوحدة والمشروع</h2>
          <InfoRow
            icon={<Building2 />}
            label="المشروع"
            value={project ? tx(project.name) : '—'}
          />
          <InfoRow
            icon={<Home />}
            label="الوحدة"
            value={
              contract.unit ? (
                <span className="font-mono" dir="ltr">
                  {contract.unit.code} • {contract.unit.type}
                </span>
              ) : (
                '—'
              )
            }
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">المالية</h2>
          <InfoRow
            icon={<Banknote />}
            label="قيمة العقد"
            value={formatCurrency(contract.totalAmount)}
          />
          <InfoRow
            icon={<Banknote />}
            label="الدفعة المقدمة"
            value={formatCurrency(contract.downPayment)}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الإنشاء"
            value={formatDateTime(contract.createdAt)}
          />
          {contract.signedAt && (
            <InfoRow
              icon={<CheckCircle2 />}
              label="تاريخ التوقيع"
              value={formatDate(contract.signedAt)}
            />
          )}
        </Card>
      </div>

      {contract.reservation && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-brand-600" />
            لقطة العمولة (Snapshot)
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            مأخوذة من الحجز المصدر وقت إنشائه. لا تتغير بعد إنشاء العقد.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">النسبة المُقفلة</p>
              <p className="font-semibold mt-1 text-slate-900">
                {contract.reservation.commissionLockedPct !== null &&
                contract.reservation.commissionLockedPct !== undefined
                  ? `${Number(contract.reservation.commissionLockedPct).toFixed(2)}%`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">المبلغ المُقفل</p>
              <p className="font-semibold mt-1 text-slate-900">
                {contract.reservation.commissionLockedAmount !== null &&
                contract.reservation.commissionLockedAmount !== undefined
                  ? formatCurrency(contract.reservation.commissionLockedAmount)
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">المندوب الداخلي</p>
              <p className="font-semibold mt-1 text-slate-900">
                {contract.reservation.sales?.fullName ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">الفرصة</p>
              <p className="font-semibold mt-1 text-slate-900">
                {contract.reservation.lead?.fullName ?? '—'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {contract.pdfUrl && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" />
            ملف العقد
          </h2>
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-700 hover:text-brand-800 underline"
            dir="ltr"
          >
            فتح الملف (PDF)
          </a>
        </Card>
      )}

      {contract.installmentPlan && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">خطة التقسيط</h2>
          <p className="text-xs text-slate-500">
            {contract.installmentPlan.totalMonths} شهر • قسط شهري{' '}
            {formatCurrency(contract.installmentPlan.monthlyAmount)} • تبدأ في{' '}
            {formatDate(contract.installmentPlan.startsAt)}
          </p>
        </Card>
      )}
    </div>
  );
}
