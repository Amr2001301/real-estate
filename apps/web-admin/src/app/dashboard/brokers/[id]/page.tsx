import Link from 'next/link';
import {
  Pencil,
  Users as UsersIcon,
  ShieldCheck,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  CalendarRange,
  Banknote,
  FileText,
  Hash,
  BarChart3,
  BookmarkCheck,
  BadgePercent,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { BrokerStatusBadge } from '@/components/badges';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function commissionModelLabel(model: string, m: ReturnType<typeof uiT>['pages']['brokerDetail']): string {
  if (model === 'PERCENT_OF_SALE') return m.commissionModelPercent;
  if (model === 'FIXED_PER_UNIT') return m.commissionModelFixed;
  if (model === 'TIERED') return m.commissionModelTiered;
  return model;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SideRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span
        className="text-[13px] font-semibold text-slate-900 text-end truncate max-w-[55%]"
        dir={ltr ? 'ltr' : undefined}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums text-slate-700 shrink-0">{value}</span>
    </div>
  );
}

const CMD_ROW = 'group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors duration-150 hover:bg-canvas/40';
const CMD_ICON_BASE = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]';

export default async function BrokerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerDetail;
  const r = await safe(api.get<Broker>(`/brokers/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        {m.errorLoad}{r.error ?? m.errorNotFound}
      </div>
    );
  }

  const broker = r.data;
  const counts = broker._count ?? { brokerUsers: 0, projectAccess: 0, unitAccess: 0 };
  const commissionModel = commissionModelLabel(broker.commissionModel, m);

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={broker.companyName}
        description={broker.commercialName ?? undefined}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: broker.companyName },
        ]}
        meta={
          <>
            <BrokerStatusBadge status={broker.status} />
            <span className="font-mono text-xs text-slate-500" dir="ltr">{broker.code}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/brokers/${broker.id}/edit` as never}>
              <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>{m.btnEdit}</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/users` as never}>
              <Button variant="outline" size="md" leftIcon={<UsersIcon className="h-4 w-4" />}>{m.btnEmployees}</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/access` as never}>
              <Button variant="outline" size="md" leftIcon={<ShieldCheck className="h-4 w-4" />}>{m.btnPermissions}</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/performance` as never}>
              <Button variant="outline" size="md" leftIcon={<BarChart3 className="h-4 w-4" />}>{m.btnPerformance}</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/edit#status` as never}>
              <Button variant="ghost" size="md">{m.btnChangeStatus}</Button>
            </Link>
          </div>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: m.kpiEmployees,
            value: String(counts.brokerUsers),
            icon: <UsersIcon />,
            tone: 'brand',
          },
          {
            label: m.kpiProjects,
            value: String(counts.projectAccess),
            icon: <Briefcase />,
            tone: 'info',
          },
          {
            label: m.kpiUnits,
            value: String(counts.unitAccess),
            icon: <ShieldCheck />,
            tone: 'success',
          },
          {
            label: m.kpiDefaultCommission,
            value: `${Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%`,
            icon: <Banknote />,
            sub: commissionModel,
            tone: 'brand',
          },
        ]}
      />

      {/* ── Detail layout ─────────────────────────────────────────────── */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* Contact */}
            <PremiumSectionCard title={m.sectionContact} icon={<Mail />} padded={false}>
              {/* Contact tiles */}
              <div className="grid grid-cols-2 gap-3 p-5">
                {/* Phone tile */}
                <div className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <Phone />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">{m.labelPhone}</p>
                    <p className="text-[13px] font-semibold text-slate-900 truncate" dir="ltr">
                      {broker.phone ?? '—'}
                    </p>
                  </div>
                </div>
                {/* Email tile */}
                <div className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <Mail />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">{m.labelEmail}</p>
                    <p className="text-[13px] font-semibold text-slate-900 truncate" dir="ltr">
                      {broker.email ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
              {/* City + Address */}
              <div className="border-t border-hairline divide-y divide-hairline">
                <SideRow label={m.labelCity} value={broker.city} />
                <SideRow label={m.labelAddress} value={broker.address} />
              </div>
            </PremiumSectionCard>

            {/* Legal & Banking */}
            <PremiumSectionCard title={m.sectionLegal} icon={<Hash />} padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow label={m.labelTaxId} value={broker.taxId} ltr />
                <SideRow label={m.labelCommReg} value={broker.commercialRegistration} ltr />
                <SideRow label={m.labelBank} value={broker.bankName} />
                <SideRow label={m.labelBankAccountName} value={broker.bankAccountName} />
                <SideRow label={m.labelIban} value={broker.bankIban} ltr />
              </div>
            </PremiumSectionCard>

            {/* Internal notes */}
            {broker.notes && (
              <PremiumSectionCard title={m.sectionNotes}>
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {broker.notes}
                </p>
              </PremiumSectionCard>
            )}

            {/* Documents */}
            <OwnerDocumentsCard
              ownerType="BROKER"
              ownerId={broker.id}
              legacy={
                broker.contractPdfUrl
                  ? [{ label: m.legacyDocLabel, href: broker.contractPdfUrl, hint: m.legacyDocHint }]
                  : undefined
              }
            />
          </div>
        }
        side={
          <div className="space-y-5">

            {/* Command panel */}
            <PremiumCommandPanel title={m.cmdTitle}>
              <Link href={`/dashboard/brokers/${broker.id}/performance` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-brand-50 text-brand-600`}><BarChart3 /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdPerformance}</span>
              </Link>
              <Link href={`/dashboard/broker-leads?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-sky-50 text-sky-600`}><UsersIcon /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdLeads}</span>
              </Link>
              <Link href={`/dashboard/broker-reservations?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-amber-50 text-amber-600`}><BookmarkCheck /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdReservations}</span>
              </Link>
              <Link href={`/dashboard/broker-contracts?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-emerald-50 text-emerald-600`}><FileText /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdContracts}</span>
              </Link>
              <Link href={`/dashboard/broker-commissions?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-violet-50 text-violet-600`}><BadgePercent /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdCommissions}</span>
              </Link>
              <Link href={`/dashboard/broker-payouts?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-blue-50 text-blue-600`}><Wallet /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdPayouts}</span>
              </Link>
              <Link href={`/dashboard/brokers/${broker.id}/users` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-slate-100 text-slate-500`}><UsersIcon /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdEmployees}</span>
              </Link>
              <Link href={`/dashboard/brokers/${broker.id}/access` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-slate-100 text-slate-500`}><ShieldCheck /></span>
                <span className="text-[13px] font-semibold text-slate-800">{m.cmdPermissions}</span>
              </Link>
            </PremiumCommandPanel>

            {/* Contract */}
            <PremiumSectionCard title={m.sectionContract} icon={<CalendarRange />} padded={false}>
              <div className="divide-y divide-hairline">
                <DateRow label={m.labelContractStart} value={formatDate(broker.contractStartAt) ?? '—'} />
                <DateRow label={m.labelContractEnd} value={formatDate(broker.contractEndAt) ?? '—'} />
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-[12px] font-medium text-slate-500 shrink-0">{m.labelContractFile}</span>
                  {broker.contractPdfUrl ? (
                    <a
                      href={broker.contractPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {m.openFile}
                    </a>
                  ) : (
                    <span className="text-[13px] text-slate-300">—</span>
                  )}
                </div>
              </div>
            </PremiumSectionCard>

          </div>
        }
      />
    </div>
  );
}
