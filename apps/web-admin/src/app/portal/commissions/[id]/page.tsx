import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FileText,
  Building2,
  Banknote,
  CalendarRange,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  BookmarkCheck,
  UserCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalCommission } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import { BrokerCommissionStatusBadge } from '@/components/badges';
import { MetricGrid, MetricTile } from '@/components/portal/metric-grid';
import { avatarColor, initials } from '@/components/portal/detail-hero';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 font-semibold shrink-0">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

export default async function PortalCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currency = await getReportsCurrency();
  const r = await safe(api.get<PortalCommission>(`/portal/commissions/${id}`));
  if (r.error || !r.data) notFound();
  const c = r.data;

  const clientName = c.contract?.customer?.fullName ?? c.reservation?.lead?.fullName;
  const isApproved = c.status === 'APPROVED';

  return (
    <div className="space-y-5">
      {/* Hero */}
      <PremiumPageHero
        title={c.commissionNumber}
        description="تفاصيل حساب العمولة — الأرقام مثبتة عند توقيع العقد ولا تتغير."
        breadcrumbs={[
          { label: 'البوابة',   href: '/portal' },
          { label: 'العمولات', href: '/portal/commissions' },
          { label: c.commissionNumber },
        ]}
        meta={
          <>
            <BrokerCommissionStatusBadge status={c.status} />
            {c.contract?.contractNumber && (
              <Link
                href={`/portal/contracts/${c.contract.id}` as never}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800"
              >
                <FileText className="h-3 w-3 text-slate-400" />
                <CodeText>{c.contract.contractNumber}</CodeText>
              </Link>
            )}
          </>
        }
      />

      {/* Rejection banner */}
      {c.status === 'REJECTED' && c.rejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{c.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Layout */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* ── Client & deal ────────────────────────────────────────── */}
            <PremiumSectionCard title="الصفقة والعميل" icon={<UserCircle className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5">
                {/* Avatar */}
                <div className={cn(
                  'h-20 w-20 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold ring-2 ring-white shadow-sm uppercase',
                  clientName ? avatarColor(clientName) : 'bg-slate-100 text-slate-400',
                )}>
                  {clientName ? initials(clientName) : '?'}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-navy tracking-tight truncate">
                    {clientName ?? '—'}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.contract && (
                      <Link
                        href={`/portal/contracts/${c.contract.id}` as never}
                        className="inline-flex items-center gap-1.5 text-2xs text-brand-600 hover:text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-1 font-medium transition-colors"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        العقد: {c.contract.contractNumber ?? '—'}
                      </Link>
                    )}
                    {c.reservation && (
                      <Link
                        href={`/portal/reservations/${c.reservation.id}` as never}
                        className="inline-flex items-center gap-1.5 text-2xs text-slate-600 hover:text-brand-700 bg-slate-50 border border-hairline rounded-lg px-2.5 py-1 font-medium transition-colors"
                      >
                        <BookmarkCheck className="h-3 w-3 shrink-0" />
                        الحجز: {c.reservation.reservationNumber ?? '—'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── Unit & project ───────────────────────────────────────── */}
            {(c.project || c.unit) && (
              <PremiumSectionCard title="الوحدة والمشروع" icon={<Building2 className="h-4 w-4" />}>
                <div className="flex flex-col gap-4">
                  {c.project && (
                    <div className="flex items-start gap-3">
                      <span className="h-10 w-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[16px] font-extrabold text-slate-900 leading-snug">{tx(c.project.name)}</p>
                        {c.project.city && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            {c.project.city}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {c.unit && (
                    <div className="flex items-center justify-between rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-3">
                      <div>
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">الوحدة</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <CodeText className="text-sm font-bold text-slate-800">{c.unit.code}</CodeText>
                          {c.unit.type && <CodeText className="text-2xs text-slate-500">{c.unit.type}</CodeText>}
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">سعر الوحدة</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{formatCurrency(c.unit.price, currency)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </PremiumSectionCard>
            )}

            {/* ── Financial breakdown ──────────────────────────────────── */}
            <PremiumSectionCard title="تفاصيل الحساب" icon={<Banknote className="h-4 w-4" />}>
              <div className="space-y-3">
                {/* Row 1: basis → rate → gross */}
                <MetricGrid cols={3}>
                  <MetricTile label="وعاء العمولة"  value={formatCurrency(c.basisAmount, currency)} />
                  <MetricTile
                    label="نسبة العمولة"
                    value={c.commissionPct !== null && c.commissionPct !== undefined ? `${Number(c.commissionPct).toFixed(2)}%` : '—'}
                    variant="accent"
                  />
                  <MetricTile label="الإجمالي" value={formatCurrency(c.grossAmount, currency)} />
                </MetricGrid>

                {/* Row 2: deductions → net */}
                <MetricGrid cols={3}>
                  <MetricTile
                    label="ضريبة القيمة المضافة"
                    value={`${Number(c.taxPct).toFixed(2)}%`}
                    sub={formatCurrency(c.taxAmount, currency)}
                  />
                  <MetricTile
                    label="الحجز الضريبي"
                    value={`${Number(c.withholdingPct).toFixed(2)}%`}
                    sub={formatCurrency(c.withholdingAmount, currency)}
                  />
                  <MetricTile
                    label="الصافي المستحق"
                    value={formatCurrency(c.netAmount, currency)}
                    variant="highlight"
                  />
                </MetricGrid>
              </div>
            </PremiumSectionCard>
          </div>
        }
        side={
          <div className="space-y-4">

            {/* ── Quick actions ────────────────────────────────────────── */}
            <PremiumCommandPanel title="إجراءات سريعة">
              {c.contract && (
                <Link href={`/portal/contracts/${c.contract.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><FileText /></span>
                  عرض العقد
                </Link>
              )}
              {c.reservation && (
                <Link href={`/portal/reservations/${c.reservation.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><BookmarkCheck /></span>
                  عرض الحجز
                </Link>
              )}
              <Link href={'/portal/commissions' as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                قائمة العمولات
              </Link>
            </PremiumCommandPanel>

            {/* ── Commission info ──────────────────────────────────────── */}
            <PremiumSectionCard title="معلومات العمولة">
              <dl className="flex flex-col gap-3">
                <InfoRow label="الحالة" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  <BrokerCommissionStatusBadge status={c.status} />
                </InfoRow>
                <InfoRow label="تاريخ الاستحقاق" icon={<CalendarRange className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700 text-xs tabular-nums">{formatDate(c.earnedAt)}</span>
                </InfoRow>
                {c.approvedAt && (
                  <InfoRow label="تاريخ الاعتماد" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    <span className="text-emerald-700 text-xs font-semibold tabular-nums">{formatDate(c.approvedAt)}</span>
                  </InfoRow>
                )}
                <InfoRow label="تاريخ الإنشاء" icon={<CalendarRange className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700 text-xs tabular-nums">{formatDate(c.createdAt)}</span>
                </InfoRow>

                {/* Net amount box */}
                <div className="pt-2 mt-1 border-t border-hairline">
                  <div className={cn(
                    'rounded-xl border px-3 py-2.5 text-center',
                    isApproved ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100',
                  )}>
                    <p className={cn('text-2xs font-semibold uppercase tracking-wide', isApproved ? 'text-emerald-500' : 'text-amber-500')}>
                      الصافي المستحق
                    </p>
                    <p className={cn('text-2xl font-black tabular-nums mt-1 leading-none', isApproved ? 'text-emerald-700' : 'text-amber-700')}>
                      {formatCurrency(c.netAmount, currency)}
                    </p>
                    <p className={cn('text-2xs mt-1', isApproved ? 'text-emerald-400' : 'text-amber-400')}>
                      إجمالي: {formatCurrency(c.grossAmount, currency)}
                    </p>
                  </div>
                </div>
              </dl>
            </PremiumSectionCard>

          </div>
        }
      />
    </div>
  );
}
