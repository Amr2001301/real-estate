import Link from 'next/link';
import {
  Building2,
  Phone,
  UserPlus,
  BookmarkCheck,
  FileText,
  Wallet,
  CalendarClock,
  BadgePercent,
  CheckCircle2,
  Activity,
  FilePen,
  CircleDollarSign,
  Copy,
  XCircle,
  Ban,
  Clock,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  PortalActivityItem,
  PortalActivityType,
  PortalLead,
  PortalMe,
  PortalPerformanceResponse,
  PortalProject,
  PortalUnit,
} from '@/lib/types';
import { Avatar } from '@/components/cockpit/cockpit';
import { tx, formatDate, formatDateTime, formatCompact, compactParts } from '@/lib/format';
import { FunnelV2, HeroAction, HeroV2, type HeroMetric } from '@/components/dashboard/admin-home';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale, type Locale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerStatusBadge, BrokerLeadStatusBadge } from '@/components/badges';
import { brokerCommissionRange } from '@/lib/broker-commission-range';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Helpers ───────────────────────────────────────────────────────────────────

type PerfSummary = PortalPerformanceResponse['summary'];
type Messages = ReturnType<typeof portalDashboardT>;

function convPct(num: number, denom: number): string | null {
  if (denom <= 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-[5px] w-[5px] rounded-full bg-brand-400/80 shrink-0" />
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── Activity meta ─────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<PortalActivityType, { color: string }> = {
  LEAD_SUBMITTED:        { color: 'bg-blue-50 text-blue-600'       },
  VISIT_REQUESTED:       { color: 'bg-purple-50 text-purple-600'   },
  LEAD_APPROVED:         { color: 'bg-green-50 text-green-600'     },
  LEAD_REJECTED:         { color: 'bg-red-50 text-red-500'         },
  LEAD_MARKED_DUPLICATE: { color: 'bg-amber-50 text-amber-600'     },
  RESERVATION_CREATED:   { color: 'bg-indigo-50 text-indigo-600'   },
  CONTRACT_CREATED:      { color: 'bg-cyan-50 text-cyan-600'       },
  CONTRACT_SIGNED:       { color: 'bg-emerald-50 text-emerald-600' },
  COMMISSION_EARNED:     { color: 'bg-teal-50 text-teal-600'       },
  COMMISSION_APPROVED:   { color: 'bg-green-50 text-green-600'     },
  COMMISSION_REJECTED:   { color: 'bg-red-50 text-red-500'         },
  COMMISSION_CANCELLED:  { color: 'bg-slate-100 text-slate-500'    },
  PAYOUT_CREATED:        { color: 'bg-blue-50 text-blue-600'       },
  PAYOUT_APPROVED:       { color: 'bg-cyan-50 text-cyan-600'       },
  PAYOUT_PROCESSING:     { color: 'bg-amber-50 text-amber-600'     },
  PAYOUT_PAID:           { color: 'bg-emerald-50 text-emerald-600' },
  PAYOUT_CANCELLED:      { color: 'bg-slate-100 text-slate-500'    },
};

function ActivityIcon({ type }: { type: PortalActivityType }) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'LEAD_SUBMITTED':        return <UserPlus className={cls} />;
    case 'VISIT_REQUESTED':       return <CalendarClock className={cls} />;
    case 'LEAD_APPROVED':         return <CheckCircle2 className={cls} />;
    case 'LEAD_REJECTED':         return <XCircle className={cls} />;
    case 'LEAD_MARKED_DUPLICATE': return <Copy className={cls} />;
    case 'RESERVATION_CREATED':   return <BookmarkCheck className={cls} />;
    case 'CONTRACT_CREATED':      return <FileText className={cls} />;
    case 'CONTRACT_SIGNED':       return <FilePen className={cls} />;
    case 'COMMISSION_EARNED':
    case 'COMMISSION_APPROVED':   return <BadgePercent className={cls} />;
    case 'COMMISSION_REJECTED':   return <XCircle className={cls} />;
    case 'COMMISSION_CANCELLED':  return <Ban className={cls} />;
    case 'PAYOUT_CREATED':
    case 'PAYOUT_APPROVED':       return <Wallet className={cls} />;
    case 'PAYOUT_PROCESSING':     return <Clock className={cls} />;
    case 'PAYOUT_PAID':           return <CircleDollarSign className={cls} />;
    case 'PAYOUT_CANCELLED':      return <Ban className={cls} />;
  }
}

// ── Broker figures (on the hero's glass strip) ─────────────────────────────────

function brokerMetrics(perf: PerfSummary | undefined, symbol: string | undefined, m: Messages, locale: Locale): HeroMetric[] {
  const k = m.home.kpi;
  const submitted      = perf?.leadsSubmitted      ?? 0;
  const approved       = perf?.leadsApproved       ?? 0;
  const reservations   = perf?.reservationsCreated ?? 0;
  const contracts      = perf?.contractsSigned     ?? 0;
  const commissionsNet = Number(perf?.commissionsNet  ?? 0);
  const payoutsNet     = Number(perf?.payoutsTotalNet ?? 0);
  const salesGross     = Number(perf?.salesGross      ?? 0);

  const approvalRate = submitted    > 0 ? Math.round((approved   / submitted)    * 100) : null;
  const closingRate  = reservations > 0 ? Math.round((contracts  / reservations) * 100) : null;
  const payoutRate   = commissionsNet > 0 ? Math.round((payoutsNet / commissionsNet) * 100) : null;
  const [salesNum, salesUnit] = perf ? compactParts(salesGross, symbol, locale) : ['—', ''];
  const [comNum, comUnit] = perf ? compactParts(commissionsNet, symbol, locale) : ['—', ''];

  return [
    { label: k.leadsSubmitted, value: perf ? submitted : '—', sub: approvalRate !== null ? k.leadsSubFn(approved, approvalRate) : k.noLeads },
    { label: k.contractsSigned, value: perf ? contracts : '—', sub: closingRate !== null ? k.contractsSubFn(reservations, closingRate) : k.noContracts },
    { label: k.salesVolume, value: salesNum, unit: salesUnit, sub: k.salesSub },
    {
      label: k.myCommissions, value: comNum, unit: comUnit,
      sub: payoutRate !== null ? k.commissionsSubFn(formatCompact(payoutsNet, symbol, locale), payoutRate) : k.noCommissions,
    },
    {
      label: k.payoutRate,
      value: payoutRate !== null ? payoutRate : '—',
      unit: payoutRate !== null ? '%' : '',
      bar: payoutRate ?? undefined,
      trend: payoutRate === null ? undefined : payoutRate >= 80 ? k.payoutAlmostFull : payoutRate >= 50 ? k.payoutPartial : k.payoutProcessing,
      tone: payoutRate === null ? undefined : payoutRate >= 80 ? 'success' : 'warning',
    },
  ];
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PortalDashboard() {
  const locale = await getLocale();
  const m = portalDashboardT(locale);
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const [
    meRes, projectsRes, unitsRes, activityRes, perfRes, leadsRes,
  ] = await Promise.all([
    safe(api.get<PortalMe>('/portal/me')),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<Paged<PortalActivityItem>>('/portal/activity?pageSize=6')),
    safe(api.get<PortalPerformanceResponse>('/portal/performance')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?pageSize=5')),
  ]);

  if (meRes.error || !meRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        {m.home.loadError}
      </div>
    );
  }

  const me           = meRes.data;
  const projects     = projectsRes.data ?? [];
  // The rate the broker earns is the one granted on each project, else the firm's default (F-040):
  // the default alone showed a rate that is not the one locked on a granted project.
  const commissionRange = brokerCommissionRange(projects, me.broker.defaultCommissionPct);
  const availableCount = unitsRes.data?.meta.total ?? 0;
  const activity     = activityRes.data?.data ?? [];
  const perf         = perfRes.data?.summary;
  const recentLeads  = leadsRes.data?.data ?? [];
  const hasContract  = !!(me.broker.contractStartAt && me.broker.contractEndAt);

  const f = m.home.funnel;
  const funnelStages = perf
    ? [
        { label: f.stages.submitted, value: perf.leadsSubmitted },
        { label: f.stages.approved, value: perf.leadsApproved, note: convPct(perf.leadsApproved, perf.leadsSubmitted) ? `${f.approvalRate} ${convPct(perf.leadsApproved, perf.leadsSubmitted)}` : undefined },
        { label: f.stages.reservations, value: perf.reservationsCreated },
        { label: f.stages.contracts, value: perf.contractsSigned, note: convPct(perf.contractsSigned, perf.reservationsCreated) ? `${f.contractRate} ${convPct(perf.contractsSigned, perf.reservationsCreated)}` : undefined },
        { label: f.stages.payouts, value: perf.payoutsPaid, note: convPct(perf.payoutsPaid, perf.contractsSigned) ? `${f.payoutRate} ${convPct(perf.payoutsPaid, perf.contractsSigned)}` : undefined },
      ]
    : [];

  return (
    <div className="dash-v2 space-y-5">

      {/* ── 1. Hero: the greeting over a photo, the broker's figures on glass ───── */}
      <HeroV2
        eyebrow={[me.broker.companyName, commissionRange ? `${m.home.commission} ${commissionRange}` : null].filter(Boolean).join(' · ')}
        title={m.home.greetingFn(me.user.fullName)}
        description={
          [
            hasContract ? `${formatDate(me.broker.contractStartAt, locale)} – ${formatDate(me.broker.contractEndAt, locale)}` : null,
            me.permissions.isPrimaryContact ? m.home.primaryContact : null,
          ].filter(Boolean).join(' · ')
        }
        image="/images/dashboard-hero.jpg"
        actions={
          <>
            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-[12px] text-[#F7F3EA] backdrop-blur-md">
              <BrokerStatusBadge status={me.broker.status} locale={locale} />
              <bdi className="num">{me.broker.code}</bdi>
            </span>
            <HeroAction href="/portal/leads/new" icon={<UserPlus />} gold>{m.home.newLeadCta}</HeroAction>
          </>
        }
        metrics={brokerMetrics(perf, symbol, m, locale)}
      />

      {/* ── 3. Leads table + Sidebar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-5">

        {/* Recent leads — 2/3 */}
        <div className="lg:col-span-2 rounded-[22px] border border-hairline bg-surface shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full border border-brand-400/50 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-brand-600" />
              </div>
              <div>
                <h2 className="font-heading text-[18px] font-bold text-slate-900 leading-snug">{m.home.leads.title}</h2>
                {leadsRes.data?.meta.total != null && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.home.leads.totalFn(leadsRes.data.meta.total)}</p>
                )}
              </div>
            </div>
            <Link
              href="/portal/leads"
              className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
            >
              {m.common.viewAll}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <EmptyState
              icon={<UserPlus />}
              title={m.home.leads.emptyTitle}
              description={m.home.leads.emptyDescription}
              action={
                <Link href="/portal/leads/new">
                  <Button variant="primary" size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
                    {m.home.leads.newLead}
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-hairline" data-testid="portal-recent-leads">
              {recentLeads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/portal/leads/${lead.id}` as never}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-muted/30 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.2fr)_120px_90px]"
                  >
                    <Avatar name={lead.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-slate-900">{lead.fullName}</p>
                      {lead.phone && (
                        <p className="mt-0.5 flex items-center gap-1 text-[12px] tabular-nums text-slate-500">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{lead.phone}</span>
                        </p>
                      )}
                    </div>
                    <div className="hidden min-w-0 items-start gap-2 text-[12.5px] md:flex">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {lead.projectInterest ? tx(lead.projectInterest.name, locale) : '—'}
                        </p>
                        {lead.projectInterest?.city && <p className="mt-0.5 truncate text-slate-500">{lead.projectInterest.city}</p>}
                      </div>
                    </div>
                    <div>
                      {lead.brokerApprovalStatus ? (
                        <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} locale={locale} />
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-500/12 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600">
                          {m.home.leads.statusNew}
                        </span>
                      )}
                    </div>
                    <span className="hidden whitespace-nowrap text-end text-[12px] tabular-nums text-slate-500 md:block">
                      {formatDate(lead.createdAt, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sidebar — 1/3: projects card fills full height */}
        <div className="rounded-[22px] border border-hairline bg-surface shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full border border-brand-400/50 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-navy leading-none">{m.home.projects.title}</h2>
                {availableCount > 0 && (
                  <p className="text-2xs text-emerald-600 font-semibold mt-0.5">{m.home.projects.availableUnitsFn(availableCount)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {projects.length}
              </span>
              <Link href="/portal/projects" className="text-2xs text-brand-700 hover:text-brand-800 font-bold">
                {m.home.projects.all}
              </Link>
            </div>
          </div>
          {projects.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400 text-center">{m.home.projects.empty}</p>
          ) : (
            <div className="divide-y divide-hairline flex-1">
              {projects.map((p) => {
                const cover = p.project.media?.[0]?.url;
                return (
                  <div
                    key={p.project.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition-colors"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={tx(p.project.name, locale)} className="h-10 w-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-14 rounded-lg bg-gradient-to-br from-amber-50 to-brand-50 border border-hairline flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-amber-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{tx(p.project.name, locale)}</p>
                      <p className="text-2xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {p.project.city}
                        {p.access.commissionPct != null && (
                          <span className="text-amber-600 font-extrabold shrink-0">
                            · {Number(p.access.commissionPct).toFixed(1)}%
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/portal/units?projectId=${p.project.id}` as never}
                      className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-brand-700 hover:text-brand-600"
                    >
                      {m.home.projects.units}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Sales Funnel ──────────────────────────────────────────────────── */}
      {funnelStages.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>{m.home.performanceSection}</SectionLabel>
          <FunnelV2 title={f.title} sub={f.subtitle} stages={funnelStages} />
        </div>
      )}

      {/* ── 5. Activity feed ─────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>{m.home.activity.section}</SectionLabel>
          <div className="rounded-[22px] border border-hairline bg-surface shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-hairline">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full border border-brand-400/50 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <h2 className="font-heading text-[18px] font-bold text-slate-900 leading-snug">{m.home.activity.title}</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.home.activity.countFn(activity.length)}</p>
                </div>
              </div>
              <Link
                href="/portal/activity"
                className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
              >
                {m.common.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline">
              {activity.slice(0, 6).map((item) => {
                const meta     = ACTIVITY_META[item.type];
                const linkHref =
                  item.entityType === 'VisitRequest'  ? '/portal/visits'
                  : item.entityType === 'Reservation' ? `/portal/reservations/${item.entityId}`
                  : item.entityType === 'Contract'    ? `/portal/contracts/${item.entityId}`
                  : item.entityType === 'Commission'  ? `/portal/commissions/${item.entityId}`
                  : item.entityType === 'Payout'      ? `/portal/payouts/${item.entityId}`
                  : item.lead                         ? `/portal/leads/${item.lead.id}`
                  : '/portal/activity';

                const subtitle = item.lead
                  ? [item.lead.fullName, item.lead.projectInterest ? tx(item.lead.projectInterest.name, locale) : null]
                      .filter(Boolean).join(' · ')
                  : m.home.activity.companyLevel;

                return (
                  <Link
                    key={item.id}
                    href={linkHref as never}
                    className="flex items-center gap-3 bg-surface px-5 py-4 hover:bg-canvas/40 transition-colors"
                  >
                    <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0', meta.color)}>
                      <ActivityIcon type={item.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-900 leading-snug truncate">{m.activityType[item.type]}</p>
                        <time className="text-2xs text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                          {formatDateTime(item.createdAt, locale)}
                        </time>
                      </div>
                      <p className="text-2xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
