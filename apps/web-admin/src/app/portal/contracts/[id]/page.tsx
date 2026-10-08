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
  ArrowLeft,
  MapPin,
  ShieldCheck,
  UserCog,
  BookmarkCheck,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalContract } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { portalReservationsContractsT } from '@/messages/portal/reservations-contracts';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import { avatarColor, initials } from '@/components/portal/detail-hero';
import { MetricGrid, MetricTile } from '@/components/portal/metric-grid';

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

function ContactCell({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
  tone: 'brand' | 'info';
}) {
  const ICON_TONE = { brand: 'bg-brand-50 text-brand-600', info: 'bg-info-50 text-info-600' };
  const inner = (
    <>
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0', ICON_TONE[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 truncate" dir="ltr">
          {value ?? <span className="text-slate-400">—</span>}
        </p>
      </div>
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline';
  if (href && value) return <a href={href} className={cn(cls, 'hover:bg-canvas transition-colors')}>{inner}</a>;
  return <div className={cls}>{inner}</div>;
}

export default async function PortalContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = portalReservationsContractsT(locale);
  const t = m.contracts.detail;
  const currency = await getReportsCurrency();
  const r = await safe(api.get<PortalContract>(`/portal/contracts/${id}`));
  if (r.error || !r.data) notFound();
  const contract = r.data;
  const project = contract.unit?.building?.phase.project;

  const clientName  = contract.customer?.fullName ?? contract.reservation?.lead?.fullName ?? '';
  const clientPhone = contract.customer?.phone    ?? contract.reservation?.lead?.phone    ?? '';
  const clientEmail = contract.customer?.email    ?? '';

  const isSigned = !!contract.signedAt;
  const balance  = Number(contract.totalAmount) - Number(contract.downPayment);

  const hasReservation = !!contract.reservation;
  const hasCommission  =
    hasReservation &&
    contract.reservation!.commissionLockedPct !== null &&
    contract.reservation!.commissionLockedPct !== undefined;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <PremiumPageHero
        title={contract.contractNumber ?? t.fallbackTitle}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: m.common.contracts, href: '/portal/contracts' },
          { label: contract.contractNumber ?? id },
        ]}
        meta={
          <>
            {isSigned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                {t.signed}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
                <CalendarRange className="h-3 w-3" />
                {t.pending}
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

      {/* Layout */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* ── Client profile ──────────────────────────────────────── */}
            <PremiumSectionCard title={m.common.client}>
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5">
                <div className={cn(
                  'h-20 w-20 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold ring-2 ring-white shadow-sm uppercase',
                  clientName ? avatarColor(clientName) : 'bg-slate-100 text-slate-400',
                )}>
                  {clientName ? initials(clientName) : '?'}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-navy tracking-tight truncate">{clientName || '—'}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isSigned ? t.clientSigned : t.clientSigning}
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientPhone && (
                      <ContactCell icon={<Phone className="h-4 w-4" />} tone="brand" label={m.common.phone} value={clientPhone} href={`tel:${clientPhone}`} />
                    )}
                    {clientEmail && (
                      <ContactCell icon={<Mail className="h-4 w-4" />} tone="info" label={m.common.email} value={clientEmail} href={`mailto:${clientEmail}`} />
                    )}
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── Unit & Project ───────────────────────────────────────── */}
            <PremiumSectionCard
              title={m.common.unitAndProject}
              icon={<Building2 className="h-4 w-4" />}
            >
              {project ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="h-10 w-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[16px] font-extrabold text-slate-900 leading-snug">{tx(project.name, locale)}</p>
                      {project.city && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />{project.city}
                        </p>
                      )}
                    </div>
                  </div>
                  {contract.unit && (
                    <div className="flex items-center justify-between rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-3">
                      <div>
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">{m.common.unit}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <CodeText className="text-sm font-bold text-slate-800">{contract.unit.code}</CodeText>
                          <CodeText className="text-2xs text-slate-500">{contract.unit.type}</CodeText>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">{m.common.noLinkedUnit}</p>
              )}
            </PremiumSectionCard>

            {/* ── Financial summary ────────────────────────────────────── */}
            <PremiumSectionCard title={t.financialTitle} icon={<Banknote className="h-4 w-4" />}>
              <MetricGrid cols={3}>
                <MetricTile
                  label={t.contractTotal}
                  value={formatCurrency(contract.totalAmount, currency)}
                  variant="accent"
                  size="lg"
                />
                <MetricTile label={t.downPayment} value={formatCurrency(contract.downPayment, currency)} size="md" />
                <MetricTile
                  label={t.balance}
                  value={formatCurrency(balance, currency)}
                  variant={balance > 0 ? 'default' : 'highlight'}
                  size="md"
                />
              </MetricGrid>
            </PremiumSectionCard>

            {/* ── Commission snapshot ──────────────────────────────────── */}
            <PremiumSectionCard
              title={t.commissionTitle}
              icon={<BadgePercent className="h-4 w-4" />}
              description={hasReservation ? t.commissionDescription : undefined}
            >
              {hasCommission ? (
                <MetricGrid cols={4}>
                  <MetricTile
                    label={t.lockedPct}
                    value={`${Number(contract.reservation!.commissionLockedPct).toFixed(2)}%`}
                    variant="accent"
                  />
                  <MetricTile
                    label={m.common.lockedAmount}
                    value={
                      contract.reservation!.commissionLockedAmount != null
                        ? formatCurrency(contract.reservation!.commissionLockedAmount, currency)
                        : '—'
                    }
                  />
                  <MetricTile label={t.internalSales} value={contract.reservation!.sales?.fullName ?? '—'} />
                  <MetricTile label={m.common.lead} value={contract.reservation!.lead?.fullName ?? '—'} />
                </MetricGrid>
              ) : (
                <div className="flex items-start gap-3 py-2 text-slate-400">
                  <BadgePercent className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500 font-medium">{t.noReservation}</p>
                    <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">
                      {t.noReservationHint}
                    </p>
                  </div>
                </div>
              )}
            </PremiumSectionCard>

            {/* ── Installment plan ─────────────────────────────────────── */}
            {contract.installmentPlan && (
              <PremiumSectionCard title={t.installmentTitle} icon={<CalendarRange className="h-4 w-4" />}>
                <MetricGrid cols={3}>
                  <MetricTile label={t.duration} value={m.common.monthsFn(contract.installmentPlan.totalMonths)} />
                  <MetricTile label={t.monthly} value={formatCurrency(contract.installmentPlan.monthlyAmount, currency)} size="md" />
                  <MetricTile label={t.firstInstallment} value={formatDate(contract.installmentPlan.startsAt)} />
                </MetricGrid>
              </PremiumSectionCard>
            )}

            {/* ── Contract PDF ─────────────────────────────────────────── */}
            {contract.pdfUrl && (
              <PremiumSectionCard title={t.pdfTitle} icon={<FileText className="h-4 w-4" />}>
                <a
                  href={contract.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-brand-700 hover:text-brand-800 font-medium"
                  dir="ltr"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t.openPdf}
                </a>
              </PremiumSectionCard>
            )}
          </div>
        }
        side={
          <div className="space-y-4">

            {/* ── Quick actions ────────────────────────────────────────── */}
            <PremiumCommandPanel title={m.common.quickActions}>
              {clientPhone && (
                <a href={`tel:${clientPhone}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Phone /></span>
                  {m.common.callClient}
                </a>
              )}
              {clientEmail && (
                <a href={`mailto:${clientEmail}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Mail /></span>
                  {m.common.sendEmail}
                </a>
              )}
              {contract.pdfUrl && (
                <a href={contract.pdfUrl} target="_blank" rel="noopener noreferrer" className={CMD_LINK}>
                  <span className={CMD_ICON}><ExternalLink /></span>
                  {t.openContractFile}
                </a>
              )}
              <Link href={'/portal/contracts' as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                {t.backToList}
              </Link>
            </PremiumCommandPanel>

            {/* ── Contract info ─────────────────────────────────────────── */}
            <PremiumSectionCard title={t.infoTitle}>
              <dl className="flex flex-col gap-3 text-sm">
                <InfoRow label={m.common.status} icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  {isSigned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-2xs font-semibold">
                      <CheckCircle2 className="h-2.5 w-2.5" />{t.signed}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-2xs font-semibold">
                      <CalendarRange className="h-2.5 w-2.5" />{t.pending}
                    </span>
                  )}
                </InfoRow>
                <InfoRow label={m.common.createdAt} icon={<CalendarRange className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700 text-xs tabular-nums">{formatDate(contract.createdAt)}</span>
                </InfoRow>
                {isSigned && (
                  <InfoRow label={t.signedAt} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    <span className="text-emerald-700 text-xs font-semibold tabular-nums">{formatDate(contract.signedAt!)}</span>
                  </InfoRow>
                )}
                {contract.reservation && (
                  <InfoRow label={t.reservationNumber} icon={<BookmarkCheck className="h-3.5 w-3.5" />}>
                    <Link
                      href={`/portal/reservations/${contract.reservation.id}` as never}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      <CodeText>{contract.reservation.reservationNumber}</CodeText>
                    </Link>
                  </InfoRow>
                )}
                {contract.reservation?.sales?.fullName && (
                  <InfoRow label={m.common.salesRep} icon={<UserCog className="h-3.5 w-3.5" />}>
                    <span className="text-slate-700 text-xs font-medium">{contract.reservation.sales.fullName}</span>
                  </InfoRow>
                )}

                {/* Commission box */}
                {hasCommission && (
                  <div className="pt-2 mt-1 border-t border-hairline">
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-center">
                      <p className="text-2xs text-amber-500 font-semibold uppercase tracking-wide">{m.common.lockedCommission}</p>
                      <p className="text-2xl font-black text-amber-700 tabular-nums mt-1 leading-none">
                        {Number(contract.reservation!.commissionLockedPct).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )}
              </dl>
            </PremiumSectionCard>

          </div>
        }
      />
    </div>
  );
}
