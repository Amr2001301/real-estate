import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Phone,
  Mail,
  Building2,
  Home,
  UserCircle,
  CalendarRange,
  Banknote,
  ChevronLeft,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalReservation } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CodeText } from '@/components/ui/code-text';
import { ReservationStatusBadge } from '@/components/badges';

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

export default async function PortalReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalReservation>(`/portal/reservations/${id}`));
  if (r.error || !r.data) notFound();
  const res = r.data;
  const project = res.unit?.building?.phase.project;

  return (
    <div className="space-y-5">
      <PageHeader
        title={res.reservationNumber ?? 'حجز'}
        description={project ? tx(project.name) : undefined}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الحجوزات', href: '/portal/reservations' },
          { label: res.reservationNumber ?? id },
        ]}
        meta={
          <>
            <ReservationStatusBadge status={res.status} />
            {res.lead && (
              <span className="text-xs text-slate-600">
                الفرصة: {res.lead.fullName}
              </span>
            )}
          </>
        }
        actions={
          <Link href="/portal/reservations">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">العميل</h2>
          <InfoRow icon={<UserCircle />} label="الاسم" value={res.lead?.fullName ?? res.client?.fullName} />
          <InfoRow
            icon={<Phone />}
            label="الجوال"
            value={res.lead?.phone ?? res.client?.phone}
            dir="ltr"
          />
          <InfoRow
            icon={<Mail />}
            label="البريد"
            value={res.lead?.email ?? res.client?.email}
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
              res.unit ? (
                <CodeText>{res.unit.code} • {res.unit.type}</CodeText>
              ) : (
                '—'
              )
            }
          />
          <InfoRow
            icon={<Banknote />}
            label="سعر الوحدة"
            value={res.unit ? formatCurrency(res.unit.price) : '—'}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">المندوب وحالة الحجز</h2>
          <InfoRow
            icon={<UserCircle />}
            label="المندوب الداخلي"
            value={res.sales?.fullName ?? '—'}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الإنشاء"
            value={formatDate(res.createdAt)}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="ينتهي في"
            value={formatDateTime(res.expiresAt)}
          />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-600" />
          لقطة العمولة (Snapshot)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">النسبة المُقفلة</p>
            <p className="font-medium mt-1 text-slate-900">
              {res.commissionLockedPct !== null && res.commissionLockedPct !== undefined
                ? `${Number(res.commissionLockedPct).toFixed(2)}%`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">المبلغ المُقفل</p>
            <p className="font-medium mt-1 text-slate-900">
              {res.commissionLockedAmount !== null && res.commissionLockedAmount !== undefined
                ? formatCurrency(res.commissionLockedAmount)
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">قيمة الحجز</p>
            <p className="font-medium mt-1 text-slate-900">
              {formatCurrency(res.bookingAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">إجمالي الخطة</p>
            <p className="font-medium mt-1 text-slate-900">
              {res.snapshotTotalPayable
                ? formatCurrency(res.snapshotTotalPayable)
                : '—'}
            </p>
          </div>
        </div>
      </Card>

      {res.notes && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">ملاحظات</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {res.notes}
          </p>
        </Card>
      )}

      {res.activities && res.activities.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">السجل</h2>
          <ul className="divide-y divide-hairline">
            {res.activities.map((a) => (
              <li key={a.id} className="py-2 text-xs flex items-center justify-between gap-3">
                <CodeText className="text-slate-700">{a.type}</CodeText>
                <CodeText className="text-2xs text-slate-500">{formatDateTime(a.createdAt)}</CodeText>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
