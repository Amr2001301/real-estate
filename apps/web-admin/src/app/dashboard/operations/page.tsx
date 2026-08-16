import Link from 'next/link';
import {
  Activity,
  BadgePercent,
  BarChart3,
  Bell,
  Briefcase,
  Clock,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
  Zap,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { AuditLogItem, OperationsSummary, Paged } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PremiumMetricStrip, PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Area / event helpers ──────────────────────────────────────────────────────

type AreaLabels = ReturnType<typeof uiT>['operationsPage']['areaLabels'];
type EventLabels = ReturnType<typeof uiT>['operationsPage']['eventLabels'];
type MethodLabels = ReturnType<typeof uiT>['operationsPage']['methodLabels'];

function areaLabel(entityType: string, labels: AreaLabels): string {
  const et = entityType.toLowerCase();
  if (et.includes('auth'))               return labels.auth;
  if (et.includes('permission'))         return labels.permission;
  if (et.includes('broker-lead'))        return labels.brokerLead;
  if (et.includes('broker-reservation')) return labels.brokerReservation;
  if (et.includes('broker-contract'))    return labels.brokerContract;
  if (et.includes('broker-commission'))  return labels.brokerCommission;
  if (et.includes('broker-payout'))      return labels.brokerPayout;
  if (et.includes('broker'))             return labels.broker;
  if (et.includes('user'))               return labels.user;
  if (et.includes('reservation'))        return labels.reservation;
  if (et.includes('contract'))           return labels.contract;
  if (et.includes('payment'))            return labels.payment;
  if (et.includes('lead'))               return labels.lead;
  if (et.includes('project'))            return labels.project;
  if (et.includes('unit'))               return labels.unit;
  if (et.includes('maintenance'))        return labels.maintenance;
  if (et.includes('document'))           return labels.document;
  if (et.includes('visit'))              return labels.visit;
  if (et.includes('notification'))       return labels.notification;
  if (et.includes('audit'))              return labels.auditLog;
  if (et.includes('setting'))            return labels.setting;
  if (et.includes('sales-target'))       return labels.salesTarget;
  if (et.includes('bonus'))              return labels.bonus;
  if (et.includes('report'))             return labels.report;
  if (et.includes('installment'))        return labels.installment;
  if (et.includes('deposit'))            return labels.deposit;
  if (et.includes('balance'))            return labels.balance;
  if (et.includes('target'))             return labels.target;
  return labels.unclassified;
}

function eventLabel(action: string, entityType: string, labels: EventLabels): string {
  const m  = action.toUpperCase();
  const et = entityType.toLowerCase();
  const c  = (kw: string) => et.includes(kw);
  const is = (methods: string[]) => methods.includes(m);

  if (c('auth'))         return is(['POST']) ? labels.authPost : labels.authOther;
  if (c('permission'))   return is(['POST', 'PATCH', 'PUT']) ? labels.permissionChange : labels.permissionOther;
  if (c('user')) {
    if (is(['POST']))         return labels.userCreate;
    if (is(['PATCH', 'PUT'])) return labels.userEdit;
    if (is(['DELETE']))       return labels.userDelete;
  }
  if (c('reservation')) {
    if (is(['POST']))         return labels.reservationCreate;
    if (is(['PATCH', 'PUT'])) return labels.reservationEdit;
    if (is(['DELETE']))       return labels.reservationCancel;
  }
  if (c('contract')) {
    if (is(['POST']))         return labels.contractCreate;
    if (is(['PATCH', 'PUT'])) return labels.contractEdit;
    if (is(['DELETE']))       return labels.contractDelete;
  }
  if (c('payout')) {
    if (is(['POST']))         return labels.payoutCreate;
    if (is(['PATCH', 'PUT'])) return labels.payoutEdit;
  }
  if (c('commission')) {
    if (is(['POST']))         return labels.commissionCreate;
    if (is(['PATCH', 'PUT'])) return labels.commissionEdit;
  }
  if (c('broker')) {
    if (is(['POST']))         return labels.brokerCreate;
    if (is(['PATCH', 'PUT'])) return labels.brokerEdit;
    if (is(['DELETE']))       return labels.brokerDelete;
  }
  if (c('payment')) {
    if (is(['POST']))         return labels.paymentCreate;
    if (is(['PATCH', 'PUT'])) return labels.paymentEdit;
  }
  if (c('lead')) {
    if (is(['POST']))         return labels.leadCreate;
    if (is(['PATCH', 'PUT'])) return labels.leadEdit;
    if (is(['DELETE']))       return labels.leadDelete;
  }
  if (c('project')) {
    if (is(['POST']))         return labels.projectCreate;
    if (is(['PATCH', 'PUT'])) return labels.projectEdit;
    if (is(['DELETE']))       return labels.projectDelete;
  }
  if (c('unit')) {
    if (is(['POST']))         return labels.unitCreate;
    if (is(['PATCH', 'PUT'])) return labels.unitEdit;
    if (is(['DELETE']))       return labels.unitDelete;
  }
  if (c('maintenance')) {
    if (is(['POST']))         return labels.maintenanceCreate;
    if (is(['PATCH', 'PUT'])) return labels.maintenanceEdit;
  }
  if (c('document')) {
    if (is(['POST']))   return labels.documentUpload;
    if (is(['DELETE'])) return labels.documentDelete;
  }
  if (c('visit')) {
    if (is(['POST']))         return labels.visitCreate;
    if (is(['PATCH', 'PUT'])) return labels.visitEdit;
  }
  if (c('notification')) return labels.notificationSend;
  if (c('setting')) {
    if (is(['POST', 'PATCH', 'PUT'])) return labels.settingChange;
    if (is(['DELETE']))               return labels.settingDelete;
  }
  if (is(['POST']))         return labels.recordCreate;
  if (is(['PATCH', 'PUT'])) return labels.recordEdit;
  if (is(['DELETE']))       return labels.recordDelete;
  return labels.systemAction;
}

function methodBadgeCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-50 text-amber-700 border border-amber-100';
    case 'DELETE': return 'bg-danger-50 text-danger-700 border border-danger-100';
    default:       return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
}

function methodIconCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-100 text-emerald-700';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-100 text-amber-700';
    case 'DELETE': return 'bg-danger-100 text-danger-700';
    default:       return 'bg-slate-100 text-slate-600';
  }
}

function methodBarCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-400';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-400';
    case 'DELETE': return 'bg-danger-500';
    default:       return 'bg-slate-400';
  }
}

function methodLabel(action: string, labels: MethodLabels): string {
  const key = action.toUpperCase() as keyof MethodLabels;
  return labels[key] ?? action;
}

type LucideIcon = React.ComponentType<{ className?: string }>;
function methodIcon(action: string): LucideIcon {
  switch (action.toUpperCase()) {
    case 'POST':   return Plus;
    case 'PATCH':
    case 'PUT':    return Pencil;
    case 'DELETE': return Trash2;
    default:       return Eye;
  }
}

function relativeTime(date: string, rt: ReturnType<typeof uiT>['operationsPage']['relativeTime']): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return rt.now;
  if (mins < 60) return rt.minutes(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return rt.hours(hrs);
  const days = Math.floor(hrs / 24);
  if (days < 7)  return rt.days(days);
  return new Date(date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

// ── Event grouping ────────────────────────────────────────────────────────────

interface EventGroup {
  firstId: string;
  action: string;
  entityType: string;
  actor: AuditLogItem['actor'];
  count: number;
  latestAt: string;
}

function groupRecentEvents(events: AuditLogItem[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const ev of events) {
    const last = groups.at(-1);
    if (
      last &&
      last.action === ev.action &&
      last.entityType === ev.entityType &&
      last.actor?.id === ev.actor?.id
    ) {
      last.count++;
    } else {
      groups.push({
        firstId: ev.id,
        action: ev.action,
        entityType: ev.entityType,
        actor: ev.actor,
        count: 1,
        latestAt: ev.createdAt,
      });
    }
  }
  return groups;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OperationsCenterPage() {
  const locale = await getLocale();
  const m = uiT(locale).operationsPage;

  const [summaryRes, recentRes] = await Promise.all([
    safe(api.get<OperationsSummary>('/operations/summary')),
    safe(api.get<Paged<AuditLogItem>>('/audit-logs?pageSize=10')),
  ]);

  const summary        = summaryRes.data;
  const recent         = recentRes.data?.data ?? [];
  const topActor       = summary?.topActors[0]?.actor ?? null;
  const topEntityEntry = summary?.topEntities[0];
  const topActionEntry = summary?.topActions[0];

  const maxEntity = Math.max(...(summary?.topEntities.map((e) => e.count) ?? [1]), 1);
  const maxAction = Math.max(...(summary?.topActions.map((a) => a.count) ?? [1]), 1);

  const deleteCount   = summary?.topActions.find((a) => a.action.toUpperCase() === 'DELETE')?.count ?? 0;
  const authCount     = summary?.topEntities.find((e) => e.entityType.toLowerCase().includes('auth'))?.count ?? 0;
  const permCount     = summary?.topEntities.find((e) => e.entityType.toLowerCase().includes('permission'))?.count ?? 0;
  const recentGroups  = groupRecentEvents(recent);

  const QUICK_LINKS = [
    { href: '/dashboard/audit-logs',         key: 'auditLogs'        as const, icon: ScrollText   },
    { href: '/dashboard/notifications',      key: 'notifications'    as const, icon: Bell         },
    { href: '/dashboard/broker-reports',     key: 'brokerReports'    as const, icon: BarChart3    },
    { href: '/dashboard/broker-payouts',     key: 'brokerPayouts'    as const, icon: Wallet       },
    { href: '/dashboard/broker-commissions', key: 'brokerCommissions' as const, icon: BadgePercent },
    { href: '/dashboard/broker-leads',       key: 'brokerLeads'      as const, icon: Briefcase    },
    { href: '/dashboard/settings',           key: 'settings'         as const, icon: Settings     },
  ] satisfies Array<{
    href: string;
    key: keyof typeof m.quickLinks;
    icon: LucideIcon;
  }>;

  return (
    <div className="flex flex-col gap-5 pb-2">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbSelf },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Activity className="h-3.5 w-3.5" />
            {m.liveBadge}
          </span>
        }
      />

      {(summaryRes.error || recentRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.errorPartial} {summaryRes.error ?? recentRes.error}
        </div>
      )}

      {summary && (
        <>
          {/* ── KPI strip ────────────────────────────────────────────────── */}
          <PremiumMetricStrip
            variant="dashboard"
            cols={4}
            metrics={[
              {
                label: m.kpi.todayEvents,
                value: summary.totals.today.toLocaleString('ar-EG'),
                icon: <Activity />,
                tone: 'brand',
                sub: m.kpi.todayEventsSub,
              },
              {
                label: m.kpi.weekEvents,
                value: summary.totals.last7Days.toLocaleString('ar-EG'),
                icon: <TrendingUp />,
                tone: 'info',
                sub: m.kpi.weekEventsSub,
              },
              {
                label: m.kpi.topUser,
                value: topActor?.fullName ?? '—',
                icon: <UsersIcon />,
                tone: 'success',
                valueSize: 'compact',
                sub: topActor ? (m.roleLabels[topActor.role as keyof typeof m.roleLabels] ?? topActor.role) : undefined,
              },
              {
                label: m.kpi.topArea,
                value: topEntityEntry ? areaLabel(topEntityEntry.entityType, m.areaLabels) : '—',
                icon: <Activity />,
                tone: 'purple',
                valueSize: 'compact',
                sub: topEntityEntry ? m.kpi.topAreaSub(topEntityEntry.count) : undefined,
              },
            ]}
          />

          {/* ── Secondary insights strip ─────────────────────────────────── */}
          <PremiumMetricStrip
            variant="compact"
            cols={4}
            metrics={[
              {
                label: m.kpi.topAction,
                value: topActionEntry
                  ? `${methodLabel(topActionEntry.action, m.methodLabels)} · ${topActionEntry.action}`
                  : '—',
                icon: <Zap />,
                tone: 'warning',
                sub: topActionEntry ? m.kpi.topActionSub(topActionEntry.count) : undefined,
              },
              {
                label: m.kpi.lastActivity,
                value: recent[0] ? relativeTime(recent[0].createdAt, m.relativeTime) : '—',
                icon: <Clock />,
                tone: 'brand',
              },
              {
                label: m.kpi.total30,
                value: summary.totals.last30Days.toLocaleString('ar-EG'),
                icon: <TrendingUp />,
                tone: 'success',
              },
              {
                label: m.kpi.deletions,
                value: deleteCount === 0 ? m.kpi.deletionsNone : deleteCount.toLocaleString('ar-EG'),
                icon: <Shield />,
                tone: deleteCount > 0 ? 'danger' : 'neutral',
              },
            ]}
          />

          {/* ── Main two-column section ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* ── Latest events (2/3) ──────────────────────────────────────── */}
            <PremiumSectionCard
              className="lg:col-span-2"
              icon={<ScrollText />}
              title={m.sections.latestEvents}
              description={m.sections.latestEventsDesc}
              trailing={
                <Link href="/dashboard/audit-logs">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                  >
                    {m.sections.openAuditLog}
                  </Button>
                </Link>
              }
              padded={false}
            >
              {recentGroups.length === 0 && summary.topEntities.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    icon={<ScrollText />}
                    title={m.emptyEvents}
                    description={m.emptyEventsDesc}
                  />
                </div>
              ) : (
                <>
                  {/* Grouped recent events */}
                  {recentGroups.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-5 py-2.5 border-b border-hairline bg-canvas/40">
                        {m.sections.recentActivity}
                      </p>
                      <ul className="divide-y divide-hairline">
                        {recentGroups.map((g) => {
                          const Icon = methodIcon(g.action);
                          const href = g.count === 1
                            ? `/dashboard/audit-logs/${g.firstId}`
                            : `/dashboard/audit-logs?entityType=${encodeURIComponent(g.entityType)}&action=${encodeURIComponent(g.action)}`;
                          return (
                            <li key={g.firstId}>
                              <Link
                                href={href}
                                className="group flex items-center gap-4 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                              >
                                {/* Method icon */}
                                <span className={cn(
                                  'shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl',
                                  methodIconCls(g.action),
                                )}>
                                  <Icon className="h-4 w-4" />
                                </span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                                      {eventLabel(g.action, g.entityType, m.eventLabels)}
                                    </p>
                                    {g.count > 1 && (
                                      <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums whitespace-nowrap">
                                        {m.timesCount(g.count)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                                    {m.byLabel}{' '}
                                    <span className="font-medium text-slate-700">
                                      {g.actor?.fullName ?? m.systemActor}
                                    </span>
                                    {' · '}
                                    {areaLabel(g.entityType, m.areaLabels)}
                                    {' · '}
                                    {relativeTime(g.latestAt, m.relativeTime)}
                                  </p>
                                </div>

                                {/* Method badge + eye */}
                                <div className="shrink-0 flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono',
                                      methodBadgeCls(g.action),
                                    )}
                                    dir="ltr"
                                  >
                                    {g.action}
                                  </span>
                                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
                                    <Eye className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}

                  {/* Weekly entity activity */}
                  {summary.topEntities.length > 0 && (
                    <>
                      <p className={cn(
                        'text-[10px] font-bold uppercase tracking-widest text-slate-400 px-5 py-2.5 border-b border-hairline bg-canvas/40',
                        recentGroups.length > 0 && 'border-t',
                      )}>
                        {m.sections.weekByArea}
                      </p>
                      <ul className="divide-y divide-hairline">
                        {summary.topEntities.map((e) => (
                          <li key={e.entityType}>
                            <Link
                              href={`/dashboard/audit-logs?entityType=${encodeURIComponent(e.entityType)}`}
                              className="group flex items-center gap-4 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                            >
                              <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-brand-50 text-brand-600">
                                <Activity className="h-4 w-4" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-slate-900 truncate">
                                  {areaLabel(e.entityType, m.areaLabels)}
                                </p>
                                <p className="text-[12px] text-slate-500 mt-0.5">
                                  {m.sections.weekByAreaSub(e.count)}
                                </p>
                              </div>
                              <span className="shrink-0 text-[13px] font-bold tabular-nums bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                                {e.count}
                              </span>
                              <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
                                <Eye className="h-3.5 w-3.5" />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </PremiumSectionCard>

            {/* ── Side column ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Quick links */}
              <PremiumSectionCard
                icon={<Zap />}
                title={m.sections.quickLinks}
                padded={false}
              >
                <div className="grid grid-cols-2 gap-3 p-4">
                  {QUICK_LINKS.map((q) => {
                    const ql = m.quickLinks[q.key];
                    return (
                      <Link key={q.href} href={q.href} className="flex">
                        <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-hairline hover:border-brand-200 hover:bg-brand-50/40 transition-all duration-150 flex-1">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-surface-muted text-brand-600 [&_svg]:h-4 [&_svg]:w-4">
                            <q.icon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[12px] font-semibold text-slate-900 leading-tight">{ql.label}</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{ql.desc}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </PremiumSectionCard>

            </div>
          </div>

          {/* ── Bottom row: sensitive activity + distributions (3-col) ────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* Sensitive activity */}
            <PremiumSectionCard
              icon={<Shield />}
              title={m.sections.sensitiveActivity}
              tone="warning"
              padded={false}
            >
              <div className="divide-y divide-hairline">
                {[
                  { label: m.sensitiveRows.deletions,  count: deleteCount, warn: deleteCount > 0, icon: <Trash2 className="h-4 w-4" /> },
                  { label: m.sensitiveRows.authEvents,  count: authCount,   warn: false,           icon: <Shield className="h-4 w-4" /> },
                  { label: m.sensitiveRows.permChanges, count: permCount,   warn: permCount > 0,   icon: <UsersIcon className="h-4 w-4" /> },
                ].map(({ label, count, warn, icon }) => (
                  <div key={label} className="flex items-center gap-3.5 px-5 py-4">
                    <span className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                      warn ? 'bg-danger-50 text-danger-600' : 'bg-slate-100 text-slate-500',
                    )}>
                      {icon}
                    </span>
                    <span className="flex-1 text-[13px] font-medium text-slate-700">{label}</span>
                    <span className={cn(
                      'text-[20px] font-black tabular-nums shrink-0',
                      warn ? 'text-danger-700' : 'text-slate-400',
                    )}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </PremiumSectionCard>

            {/* By action */}
            <PremiumSectionCard
              icon={<Activity />}
              title={m.sections.byAction}
              padded={false}
            >
              {summary.topActions.length === 0 ? (
                <p className="text-[12px] text-slate-400 px-5 py-8 text-center">{m.sections.noData}</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {summary.topActions.map((a) => {
                    const pct = Math.round((a.count / maxAction) * 100);
                    return (
                      <div key={a.action} className="flex items-center gap-4 px-5 py-4">
                        <div className="flex items-center gap-2.5 shrink-0 w-28">
                          <span className="text-[13px] font-semibold text-slate-800">
                            {methodLabel(a.action, m.methodLabels)}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md',
                              methodBadgeCls(a.action),
                            )}
                            dir="ltr"
                          >
                            {a.action}
                          </span>
                        </div>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', methodBarCls(a.action))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-bold tabular-nums text-slate-900 w-8 text-right shrink-0">
                          {a.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </PremiumSectionCard>

            {/* By area */}
            <PremiumSectionCard
              icon={<BarChart3 />}
              title={m.sections.byArea}
              padded={false}
            >
              {summary.topEntities.length === 0 ? (
                <p className="text-[12px] text-slate-400 px-5 py-8 text-center">{m.sections.noData}</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {summary.topEntities.map((e) => {
                    const pct = Math.round((e.count / maxEntity) * 100);
                    return (
                      <div key={e.entityType} className="flex items-center gap-4 px-5 py-4">
                        <span className="text-[13px] font-semibold text-slate-800 shrink-0 w-28 truncate">
                          {areaLabel(e.entityType, m.areaLabels)}
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-bold tabular-nums text-slate-900 w-8 text-right shrink-0">
                          {e.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </PremiumSectionCard>

          </div>
        </>
      )}
    </div>
  );
}
