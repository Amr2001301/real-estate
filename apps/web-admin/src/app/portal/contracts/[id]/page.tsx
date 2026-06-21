import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FileText,
  Phone,
  Mail,
  Building2,
  Banknote,
  CheckCircle2,
  CalendarRange,
  ExternalLink,
  BadgePercent,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalContract } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { PremiumPageHero } from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import {
  DetailHero,
  DetailHeroCol,
  HeroColLabel,
  HeroDateRow,
  avatarColor,
  initials,
  type DetailHeroStatus,
} from '@/components/portal/detail-hero';
import { MetricGrid, MetricTile } from '@/components/portal/metric-grid';
import { DetailSection } from '@/components/portal/detail-section';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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

  const clientName  = contract.customer?.fullName ?? contract.reservation?.lead?.fullName ?? '';
  const clientPhone = contract.customer?.phone    ?? contract.reservation?.lead?.phone    ?? '';
  const clientEmail = contract.customer?.email    ?? '';

  const isSigned = !!contract.signedAt;
  const heroStatus: DetailHeroStatus = isSigned ? 'success' : 'warning';
  const balance = Number(contract.totalAmount) - Number(contract.downPayment);

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={contract.contractNumber ?? 'عقد'}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العقود', href: '/portal/contracts' },
          { label: contract.contractNumber ?? id },
        ]}
        meta={
          <>
            {isSigned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" />
                موقع
              </span>
            ) : (
              <span className="inline-block rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                قيد التوقيع
              </span>
            )}
            {contract.reservation?.reservationNumber && (
              <Link
                href={`/portal/reservations/${contract.reservation.id}` as never}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800"
              >
                <FileText className="h-3 w-3 text-slate-400" />
                <CodeText>{contract.reservation.reservationNumber}</CodeText>
              </Link>
            )}
          </>
        }
      />

      {/* ── Hero summary card ──────────────────────────────────────────── */}
      <DetailHero status={heroStatus}>
        {/* Client */}
        <DetailHeroCol position="first">
          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 text-lg font-bold ${avatarColor(clientName)}`}
            >
              {initials(clientName)}
            </div>
            <div className="min-w-0">
              <HeroColLabel>العميل</HeroColLabel>
              <p className="text-xl font-bold text-slate-900 leading-snug">{clientName || '—'}</p>
              {clientPhone && (
                <a
                  href={`tel:${clientPhone}`}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700 transition-colors"
                  dir="ltr"
                >
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {clientPhone}
                </a>
              )}
              {clientEmail && (
                <a
                  href={`mailto:${clientEmail}`}
                  className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700 transition-colors"
                  dir="ltr"
                >
                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[200px]">{clientEmail}</span>
                </a>
              )}
            </div>
          </div>
        </DetailHeroCol>

        {/* Unit / Project */}
        <DetailHeroCol position="middle">
          <HeroColLabel>الوحدة والمشروع</HeroColLabel>
          {project ? (
            <>
              <p className="text-lg font-bold text-slate-900 leading-snug">{tx(project.name)}</p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />
                {project.city ?? ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
          {contract.unit && (
            <div className="mt-4">
              <CodeText className="text-base font-bold text-slate-800">{contract.unit.code}</CodeText>
              <p className="text-xs text-slate-500 mt-0.5">
                <CodeText>{contract.unit.type}</CodeText>
              </p>
            </div>
          )}
        </DetailHeroCol>

        {/* Status + dates */}
        <DetailHeroCol position="last" highlight={isSigned ? 'success' : 'warning'}>
          <HeroColLabel>الحالة والتواريخ</HeroColLabel>
          <div className="flex items-center gap-2 mb-4">
            {isSigned ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <CalendarRange className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <p className={`text-base font-bold ${isSigned ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isSigned ? 'تم التوقيع' : 'قيد التوقيع'}
            </p>
          </div>
          <div className="space-y-2.5">
            <HeroDateRow
              label={<span className="flex items-center gap-1"><CalendarRange className="h-3 w-3 text-slate-400" />تاريخ الإنشاء</span>}
              value={formatDate(contract.createdAt)}
            />
            {isSigned && (
              <HeroDateRow
                label={<span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />تاريخ التوقيع</span>}
                value={formatDate(contract.signedAt!)}
                tone="success"
              />
            )}
            {contract.reservation?.reservationNumber && (
              <HeroDateRow
                label="رقم الحجز"
                value={<CodeText className="text-xs">{contract.reservation.reservationNumber}</CodeText>}
              />
            )}
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* ── Financial summary (always) ────────────────────────────────── */}
      <DetailSection icon={<Banknote />} title="الملخص المالي">
        <MetricGrid cols={3}>
          <MetricTile
            label="إجمالي العقد"
            value={formatCurrency(contract.totalAmount)}
            variant="accent"
            size="lg"
          />
          <MetricTile
            label="الدفعة المقدمة"
            value={formatCurrency(contract.downPayment)}
            size="md"
          />
          <MetricTile
            label="المبلغ المتبقي"
            value={formatCurrency(balance)}
            variant={balance > 0 ? 'default' : 'highlight'}
            size="md"
          />
        </MetricGrid>
      </DetailSection>

      {/* ── Commission snapshot (always — shows empty state if no reservation) */}
      <DetailSection
        icon={<BadgePercent />}
        title="لقطة العمولة المُقفلة"
        description={
          contract.reservation
            ? 'تم تثبيت هذه القيم عند إنشاء الحجز المصدر ولن تتغير بعد توقيع العقد.'
            : undefined
        }
      >
        {contract.reservation ? (
          <MetricGrid cols={4}>
            <MetricTile
              label="النسبة المُقفلة"
              value={
                contract.reservation.commissionLockedPct !== null &&
                contract.reservation.commissionLockedPct !== undefined
                  ? `${Number(contract.reservation.commissionLockedPct).toFixed(2)}%`
                  : '—'
              }
              variant="accent"
            />
            <MetricTile
              label="المبلغ المُقفل"
              value={
                contract.reservation.commissionLockedAmount !== null &&
                contract.reservation.commissionLockedAmount !== undefined
                  ? formatCurrency(contract.reservation.commissionLockedAmount)
                  : '—'
              }
            />
            <MetricTile
              label="المندوب الداخلي"
              value={contract.reservation.sales?.fullName ?? '—'}
            />
            <MetricTile
              label="الفرصة"
              value={contract.reservation.lead?.fullName ?? '—'}
            />
          </MetricGrid>
        ) : (
          <div className="flex items-start gap-3 py-2 text-slate-400">
            <BadgePercent className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">لا يوجد حجز مصدر مرتبط</p>
              <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">
                ستُعرض قيم العمولة المُقفلة هنا تلقائياً بعد ربط الحجز بهذا العقد.
              </p>
            </div>
          </div>
        )}
      </DetailSection>

      {/* ── Contract PDF ───────────────────────────────────────────────── */}
      {contract.pdfUrl && (
        <DetailSection icon={<FileText />} title="ملف العقد">
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-brand-700 hover:text-brand-800 font-medium"
            dir="ltr"
          >
            <ExternalLink className="h-4 w-4" />
            فتح الملف (PDF)
          </a>
        </DetailSection>
      )}

      {/* ── Installment plan ──────────────────────────────────────────── */}
      {contract.installmentPlan && (
        <DetailSection icon={<CalendarRange />} title="خطة التقسيط">
          <MetricGrid cols={3}>
            <MetricTile
              label="مدة التقسيط"
              value={`${contract.installmentPlan.totalMonths} شهر`}
            />
            <MetricTile
              label="القسط الشهري"
              value={formatCurrency(contract.installmentPlan.monthlyAmount)}
            />
            <MetricTile
              label="تاريخ أول قسط"
              value={formatDate(contract.installmentPlan.startsAt)}
            />
          </MetricGrid>
        </DetailSection>
      )}
    </div>
  );
}
