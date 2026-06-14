import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FileText,
  Building2,
  Banknote,
  CalendarRange,
  AlertTriangle,
  UserCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalCommission } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { CodeText } from '@/components/ui/code-text';
import { BrokerCommissionStatusBadge } from '@/components/badges';
import {
  DetailHero,
  DetailHeroCol,
  HeroColLabel,
  HeroDateRow,
  type DetailHeroStatus,
} from '@/components/portal/detail-hero';
import { MetricGrid, MetricTile } from '@/components/portal/metric-grid';
import { DetailSection } from '@/components/portal/detail-section';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalCommission>(`/portal/commissions/${id}`));
  if (r.error || !r.data) notFound();
  const c = r.data;

  const clientName = c.contract?.customer?.fullName ?? c.reservation?.lead?.fullName;

  const heroStatus: DetailHeroStatus =
    c.status === 'APPROVED' ? 'success' :
    c.status === 'REJECTED' || c.status === 'CANCELLED' ? 'danger' :
    'warning';

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.commissionNumber}
        description="تفاصيل حساب العمولة — الأرقام مثبتة عند توقيع العقد ولا تتغير."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العمولات', href: '/portal/commissions' },
          { label: c.commissionNumber },
        ]}
        meta={
          <>
            <BrokerCommissionStatusBadge status={c.status} />
            {c.contract?.contractNumber && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                <FileText className="h-3 w-3 text-slate-400" />
                <CodeText>{c.contract.contractNumber}</CodeText>
              </span>
            )}
          </>
        }
      />

      {/* ── Rejection reason ──────────────────────────────────────────── */}
      {c.status === 'REJECTED' && c.rejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{c.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* ── Hero summary card ──────────────────────────────────────────── */}
      <DetailHero status={heroStatus}>
        {/* Client + deal chain */}
        <DetailHeroCol position="first">
          <HeroColLabel>الصفقة والعميل</HeroColLabel>
          <div className="flex items-center gap-2 mb-3">
            <UserCircle className="h-5 w-5 text-slate-400 shrink-0" />
            <p className="text-base font-bold text-slate-900 leading-snug">{clientName ?? '—'}</p>
          </div>
          <div className="space-y-1.5 ms-7">
            {c.contract && (
              <p className="text-xs text-slate-500">
                العقد:{' '}
                <Link
                  href={`/portal/contracts/${c.contract.id}` as never}
                  className="text-brand-700 hover:text-brand-800 font-medium"
                >
                  <CodeText>{c.contract.contractNumber ?? '—'}</CodeText>
                </Link>
              </p>
            )}
            {c.reservation && (
              <p className="text-xs text-slate-500">
                الحجز:{' '}
                <Link
                  href={`/portal/reservations/${c.reservation.id}` as never}
                  className="text-brand-700 hover:text-brand-800 font-medium"
                >
                  <CodeText>{c.reservation.reservationNumber ?? '—'}</CodeText>
                </Link>
              </p>
            )}
          </div>
        </DetailHeroCol>

        {/* Unit / Project */}
        <DetailHeroCol position="middle">
          <HeroColLabel>الوحدة والمشروع</HeroColLabel>
          {c.project ? (
            <>
              <p className="text-lg font-bold text-slate-900 leading-snug">
                {tx(c.project.name)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />
                {c.unit ? <CodeText>{c.unit.type}</CodeText> : null}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
          {c.unit && (
            <div className="mt-4">
              <CodeText className="text-base font-bold text-slate-800">{c.unit.code}</CodeText>
              <p className="text-xs text-slate-500 mt-1 tabular-nums flex items-center gap-1">
                <Banknote className="h-3 w-3 text-slate-400 shrink-0" />
                {formatCurrency(c.unit.price)}
              </p>
            </div>
          )}
        </DetailHeroCol>

        {/* Net + dates */}
        <DetailHeroCol position="last">
          <HeroColLabel>الصافي المستحق</HeroColLabel>
          <p className="text-3xl font-bold text-emerald-700 tabular-nums leading-none">
            {formatCurrency(c.netAmount)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            إجمالي:{' '}
            <span className="font-semibold text-slate-700">{formatCurrency(c.grossAmount)}</span>
          </p>
          <div className="mt-4 space-y-3">
            <HeroDateRow
              label={
                <span className="flex items-center gap-1">
                  <CalendarRange className="h-3 w-3" />
                  تاريخ الاستحقاق
                </span>
              }
              value={formatDate(c.earnedAt)}
            />
            {c.approvedAt && (
              <HeroDateRow
                label="تاريخ الاعتماد"
                value={formatDate(c.approvedAt)}
                tone="success"
              />
            )}
            <HeroDateRow label="تاريخ الإنشاء" value={formatDate(c.createdAt)} />
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* ── Financial breakdown ────────────────────────────────────────── */}
      <DetailSection
        icon={<Banknote />}
        title="تفاصيل الحساب"
        bodyClass="space-y-3"
      >
        {/* Row 1: basis → rate → gross */}
        <MetricGrid cols={3}>
          <MetricTile label="وعاء العمولة" value={formatCurrency(c.basisAmount)} />
          <MetricTile
            label="نسبة العمولة"
            value={
              c.commissionPct !== null && c.commissionPct !== undefined
                ? `${Number(c.commissionPct).toFixed(2)}%`
                : '—'
            }
            variant="accent"
          />
          <MetricTile label="الإجمالي" value={formatCurrency(c.grossAmount)} />
        </MetricGrid>

        {/* Row 2: deductions → net */}
        <MetricGrid cols={3}>
          <MetricTile
            label="ضريبة القيمة المضافة"
            value={`${Number(c.taxPct).toFixed(2)}%`}
            sub={formatCurrency(c.taxAmount)}
          />
          <MetricTile
            label="الحجز الضريبي"
            value={`${Number(c.withholdingPct).toFixed(2)}%`}
            sub={formatCurrency(c.withholdingAmount)}
          />
          <MetricTile
            label="الصافي المستحق"
            value={formatCurrency(c.netAmount)}
            variant="highlight"
          />
        </MetricGrid>
      </DetailSection>
    </div>
  );
}
