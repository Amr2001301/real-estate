import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  Bell,
  Briefcase,
  Eye,
  Layers,
  KeyRound,
  Pencil,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users as UsersIcon,
  Wallet,
  Zap,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { AuditLogItem, OperationsSummary, Paged } from '@/lib/types';
import { PremiumPageHero, PremiumPanel } from '@/components/premium';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { intlLocale } from '@/lib/format';
import { ActivityTrendChart } from './_trend-chart';

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

function eventLabel(
  action: string,
  entityType: string,
  labels: EventLabels,
  domain: Record<string, string> = {},
): string {
  // A named action ("deposit.reversed") — not an HTTP method.
  if (action.includes('.')) return domainActionLabel(action, domain);
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

/** A named action's label; an unknown one is shown readably ("deposit reversed"). */
function domainActionLabel(action: string, domain: Record<string, string>): string {
  return domain[action] ?? action.replace(/[._-]+/g, ' ');
}

type ActionKind = 'create' | 'edit' | 'delete' | 'special';
function actionKind(action: string): ActionKind {
  switch (action.toUpperCase()) {
    case 'POST':   return 'create';
    case 'PATCH':
    case 'PUT':    return 'edit';
    case 'DELETE': return 'delete';
    default:       return 'special';
  }
}

function methodIconCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-500/12 text-emerald-600 ring-1 ring-inset ring-emerald-500/25';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-500/12 text-amber-600 ring-1 ring-inset ring-amber-500/25';
    case 'DELETE': return 'bg-danger-500/12 text-danger-600 ring-1 ring-inset ring-danger-500/25';
    default:       return 'bg-sky-500/12 text-sky-600 ring-1 ring-inset ring-sky-500/25';
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
    default:       return Sparkles;
  }
}

function relativeTime(
  date: string,
  rt: ReturnType<typeof uiT>['operationsPage']['relativeTime'],
  locale: Locale,
): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return rt.now;
  if (mins < 60) return rt.minutes(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return rt.hours(hrs);
  const days = Math.floor(hrs / 24);
  if (days < 7)  return rt.days(days);
  return new Date(date).toLocaleDateString(locale === 'en' ? 'en-EG' : 'ar-SA-u-nu-latn', { day: 'numeric', month: 'short' });
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

// ── Small building blocks ─────────────────────────────────────────────────────

const AREA_COLORS = ['bg-brand-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-400', 'bg-slate-400'];
const KIND_COLORS: Record<ActionKind, string> = {
  create: 'bg-emerald-500',
  edit: 'bg-amber-400',
  delete: 'bg-danger-500',
  special: 'bg-sky-500',
};

function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-600/20 font-bold text-brand-700 ring-1 ring-inset ring-brand-500/30',
        size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-10 w-10 text-[13px]',
      )}
    >
      {initials(name)}
    </span>
  );
}

/** One of the four insight cards under the hero. */
function InsightCard({
  icon,
  label,
  value,
  sub,
  lead,
  tone = 'neutral',
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  lead?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn';
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-[20px] border bg-surface p-5 transition-colors',
        tone === 'good' && 'border-emerald-500/25',
        tone === 'warn' && 'border-amber-500/40',
        tone === 'neutral' && 'border-hairline hover:border-brand-500/30',
      )}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5',
            tone === 'good' ? 'bg-emerald-500/12 text-emerald-600' : tone === 'warn' ? 'bg-amber-500/15 text-amber-600' : 'bg-brand-500/12 text-brand-700',
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {lead}
        <div className="min-w-0">
          <p className="truncate text-[19px] font-bold leading-tight text-slate-900">{value}</p>
          {sub && <p className="mt-1 truncate text-[12px] text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OperationsCenterPage() {
  const locale = await getLocale();
  const m = uiT(locale).operationsPage;
  const num = (n: number) => n.toLocaleString(intlLocale(locale));

  const [summaryRes, recentRes] = await Promise.all([
    safe(api.get<OperationsSummary>('/operations/summary')),
    safe(api.get<Paged<AuditLogItem>>('/audit-logs?pageSize=12')),
  ]);

  const summary = summaryRes.data;
  const recent = recentRes.data?.data ?? [];
  const recentGroups = groupRecentEvents(recent).slice(0, 8);
  const week = summary?.totals.last7Days ?? 0;
  const prevWeek = summary?.totals.previous7Days ?? null;
  const weekDelta = prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : null;
  const daily = summary?.daily ?? [];
  const peak = daily.reduce<{ date: string; count: number } | null>((p, d) => (!p || d.count > p.count ? d : p), null);
  const dayFmt = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short' });
  const dayLabel = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00Z`));

  // Areas: entity types that read the same ("deposits", "deposit-reviews")
  // are one area; the rest of the week is "other".
  const areaTotals = new Map<string, number>();
  for (const e of summary?.topEntities ?? []) {
    const label = areaLabel(e.entityType, m.areaLabels);
    areaTotals.set(label, (areaTotals.get(label) ?? 0) + e.count);
  }
  const areas = [...areaTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const otherAreas = Math.max(0, week - areas.reduce((s, [, n]) => s + n, 0));
  const areaRows = [...areas, ...(otherAreas > 0 ? [[m.distribution.others, otherAreas] as [string, number]] : [])];

  // Kinds of actions: create / edit / delete / named ("special") actions.
  const kinds: Record<ActionKind, number> = { create: 0, edit: 0, delete: 0, special: 0 };
  for (const a of summary?.topActions ?? []) kinds[actionKind(a.action)] += a.count;
  kinds.special += Math.max(0, week - Object.values(kinds).reduce((s, n) => s + n, 0));
  const kindRows = (Object.keys(kinds) as ActionKind[]).filter((k) => kinds[k] > 0);

  const topActor = summary?.topActors[0] ?? null;
  const topArea = areas[0] ?? null;
  const topActionEntry = summary?.topActions[0];
  const deleteCount = summary?.topActions.find((a) => a.action.toUpperCase() === 'DELETE')?.count ?? 0;
  const authCount = summary?.topEntities.filter((e) => e.entityType.toLowerCase().includes('auth')).reduce((s, e) => s + e.count, 0) ?? 0;
  const permCount = summary?.topEntities.filter((e) => e.entityType.toLowerCase().includes('permission')).reduce((s, e) => s + e.count, 0) ?? 0;
  const sensitive = deleteCount + permCount;
  const pct = (n: number) => (week > 0 ? Math.round((n / week) * 100) : 0);

  const QUICK_LINKS = [
    { href: '/dashboard/audit-logs',         key: 'auditLogs'        as const, icon: ScrollText   },
    { href: '/dashboard/notifications',      key: 'notifications'    as const, icon: Bell         },
    { href: '/dashboard/broker-reports',     key: 'brokerReports'    as const, icon: BarChart3    },
    { href: '/dashboard/broker-payouts',     key: 'brokerPayouts'    as const, icon: Wallet       },
    { href: '/dashboard/broker-commissions', key: 'brokerCommissions' as const, icon: BadgePercent },
    { href: '/dashboard/broker-leads',       key: 'brokerLeads'      as const, icon: Briefcase    },
    { href: '/dashboard/settings',           key: 'settings'         as const, icon: Settings     },
  ] satisfies Array<{ href: string; key: keyof typeof m.quickLinks; icon: LucideIcon }>;

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[{ label: m.breadcrumbHome, href: '/dashboard' }, { label: m.breadcrumbSelf }]}
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {m.liveBadge}
          </span>
        }
      />

      {(summaryRes.error || recentRes.error) && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">
          {m.errorPartial} {summaryRes.error ?? recentRes.error}
        </div>
      )}

      {summary && (
        <>
          {/* ── Hero: today, the trend, the totals ─────────────────────────── */}
          <section
            data-testid="ops-hero"
            className="relative overflow-hidden rounded-[26px] border border-hairline bg-surface"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.09] via-transparent to-transparent" />
            <div className="pointer-events-none absolute -top-24 start-1/3 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
            <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-10">
              <div className="flex flex-col justify-between gap-6">
                <div>
                  <p className="text-[13px] font-semibold text-slate-500">{m.hero.today}</p>
                  <p className="mt-2 text-[64px] font-bold leading-none tracking-tight text-slate-900 tabular-nums" data-testid="ops-today">
                    {num(summary.totals.today)}
                  </p>
                  {weekDelta !== null && (
                    <span
                      className={cn(
                        'mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold',
                        weekDelta > 0 && 'bg-emerald-500/12 text-emerald-600',
                        weekDelta < 0 && 'bg-danger-500/10 text-danger-600',
                        weekDelta === 0 && 'bg-surface-muted text-slate-500',
                      )}
                    >
                      {weekDelta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : weekDelta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                      {weekDelta === 0 ? m.hero.flat : m.hero.vsLastWeek(weekDelta)}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-4 border-t border-hairline pt-5">
                  {[
                    { label: m.hero.week, value: num(week) },
                    { label: m.hero.month, value: num(summary.totals.last30Days) },
                    { label: m.hero.last, value: recent[0] ? relativeTime(recent[0].createdAt, m.relativeTime, locale) : '—' },
                  ].map((s) => (
                    <div key={s.label} className="min-w-0">
                      <dt className="truncate text-[11px] font-medium text-slate-500">{s.label}</dt>
                      <dd className="mt-1 truncate text-[16px] font-bold text-slate-900 tabular-nums">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-heading text-[17px] font-bold text-slate-900">{m.hero.trend}</p>
                  {peak && peak.count > 0 && (
                    <p className="text-[12px] text-slate-500">{m.hero.peak(peak.count, dayLabel(peak.date))}</p>
                  )}
                </div>
                {daily.length > 1 ? (
                  <>
                    <ActivityTrendChart
                      days={daily}
                      label={m.hero.trend}
                      format={(n, d) => m.hero.eventsOn(n, dayLabel(d))}
                    />
                    <div className="flex justify-between text-[11px] text-slate-400" dir="ltr">
                      <span>{dayLabel(daily[0]!.date)}</span>
                      <span>{dayLabel(daily[Math.floor(daily.length / 2)]!.date)}</span>
                      <span>{dayLabel(daily.at(-1)!.date)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-hairline py-12 text-[13px] text-slate-500">
                    {m.sections.noData}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Insights ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InsightCard
              testId="ops-top-user"
              icon={<UsersIcon />}
              label={m.insights.topUser}
              lead={topActor?.actor ? <Avatar name={topActor.actor.fullName} /> : undefined}
              value={topActor?.actor?.fullName ?? m.insights.none}
              sub={
                topActor?.actor
                  ? `${m.roleLabels[topActor.actor.role as keyof typeof m.roleLabels] ?? topActor.actor.role} · ${m.insights.topUserSub(topActor.count)}`
                  : undefined
              }
            />
            <InsightCard
              testId="ops-top-area"
              icon={<Layers />}
              label={m.insights.topArea}
              value={topArea?.[0] ?? m.insights.none}
              sub={topArea ? m.insights.share(pct(topArea[1])) : undefined}
            />
            <InsightCard
              testId="ops-top-action"
              icon={<Zap />}
              label={m.insights.topAction}
              value={
                topActionEntry
                  ? topActionEntry.action.includes('.')
                    ? domainActionLabel(topActionEntry.action, m.domainActions)
                    : methodLabel(topActionEntry.action, m.methodLabels)
                  : m.insights.none
              }
              sub={topActionEntry ? m.insights.times(topActionEntry.count) : undefined}
            />
            <InsightCard
              testId="ops-security"
              icon={sensitive > 0 ? <ShieldAlert /> : <ShieldCheck />}
              tone={sensitive > 0 ? 'warn' : 'good'}
              label={m.insights.security}
              value={sensitive > 0 ? m.insights.securityItems(sensitive) : m.insights.securityClear}
              sub={m.security.sub}
            />
          </div>

          {/* ── Timeline + breakdown ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-6">
            <PremiumPanel
              className="lg:col-span-2"
              title={m.timeline.title}
              sub={m.timeline.sub}
              link={{ href: '/dashboard/audit-logs', label: m.timeline.viewAll }}
            >
              {recentGroups.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon={<ScrollText />} title={m.emptyEvents} description={m.emptyEventsDesc} />
                </div>
              ) : (
                <ol className="flex flex-col" data-testid="ops-timeline">
                  {recentGroups.map((g, i) => {
                    const Icon = methodIcon(g.action);
                    const href =
                      g.count === 1
                        ? `/dashboard/audit-logs/${g.firstId}`
                        : `/dashboard/audit-logs?entityType=${encodeURIComponent(g.entityType)}&action=${encodeURIComponent(g.action)}`;
                    const last = i === recentGroups.length - 1;
                    return (
                      <li key={g.firstId} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full', methodIconCls(g.action))}>
                            <Icon className="h-4 w-4" />
                          </span>
                          {!last && <span className="my-1 w-px flex-1 bg-hairline" />}
                        </div>
                        <Link
                          href={href as never}
                          className={cn(
                            'group -mt-0.5 flex min-w-0 flex-1 items-start justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-surface-muted/60',
                            !last && 'mb-2',
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[14px] font-semibold text-slate-900">
                                {eventLabel(g.action, g.entityType, m.eventLabels, m.domainActions)}
                              </p>
                              {g.count > 1 && (
                                <span className="shrink-0 rounded-full bg-brand-500/12 px-2 py-0.5 text-[10px] font-bold text-brand-700 tabular-nums">
                                  ×{num(g.count)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <Avatar name={g.actor?.fullName ?? m.systemActor} size="sm" />
                                <span className="font-medium text-slate-700">{g.actor?.fullName ?? m.systemActor}</span>
                              </span>
                              <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px]">
                                {areaLabel(g.entityType, m.areaLabels)}
                              </span>
                            </div>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-0.5 text-[11.5px] text-slate-400">
                            {relativeTime(g.latestAt, m.relativeTime, locale)}
                            <Eye className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </PremiumPanel>

            <div className="flex flex-col gap-5 lg:gap-6">
              <PremiumPanel title={m.distribution.title} sub={m.distribution.sub}>
                {areaRows.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-slate-500">{m.sections.noData}</p>
                ) : (
                  <div className="flex flex-col gap-5" data-testid="ops-areas">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted" dir="ltr">
                      {areaRows.map(([label, n], i) => (
                        <span key={label} className={cn('h-full', AREA_COLORS[i % AREA_COLORS.length])} style={{ width: `${pct(n)}%` }} />
                      ))}
                    </div>
                    <ul className="flex flex-col gap-3">
                      {areaRows.map(([label, n], i) => (
                        <li key={label} className="flex items-center gap-3 text-[13px]">
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', AREA_COLORS[i % AREA_COLORS.length])} />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{label}</span>
                          <span className="font-bold text-slate-900 tabular-nums">{num(n)}</span>
                          <span className="w-10 text-end text-[12px] text-slate-400 tabular-nums">{pct(n)}%</span>
                        </li>
                      ))}
                    </ul>

                    {kindRows.length > 0 && (
                      <div className="border-t border-hairline pt-4">
                        <p className="mb-3 text-[12px] font-semibold text-slate-500">{m.distribution.kinds}</p>
                        <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" dir="ltr">
                          {kindRows.map((k) => (
                            <span key={k} className={cn('h-full', KIND_COLORS[k])} style={{ width: `${pct(kinds[k])}%` }} />
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px]">
                          {kindRows.map((k) => (
                            <span key={k} className="inline-flex items-center gap-1.5 text-slate-600">
                              <span className={cn('h-2 w-2 rounded-full', KIND_COLORS[k])} />
                              {m.distribution.kindLabels[k]}
                              <b className="text-slate-900 tabular-nums">{num(kinds[k])}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </PremiumPanel>

              <PremiumPanel title={m.security.title} sub={m.security.sub} padding="none">
                <ul className="divide-y divide-hairline border-t border-hairline" data-testid="ops-security-list">
                  {[
                    { label: m.sensitiveRows.deletions, count: deleteCount, flag: deleteCount > 0, icon: <Trash2 className="h-4 w-4" /> },
                    { label: m.sensitiveRows.permChanges, count: permCount, flag: permCount > 0, icon: <KeyRound className="h-4 w-4" /> },
                    { label: m.sensitiveRows.authEvents, count: authCount, flag: false, icon: <ShieldCheck className="h-4 w-4" /> },
                  ].map((r) => (
                    <li key={r.label} className="flex items-center gap-3 px-6 py-3.5">
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          r.flag ? 'bg-amber-500/15 text-amber-600' : 'bg-surface-muted text-slate-500',
                        )}
                      >
                        {r.icon}
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-slate-700">{r.label}</span>
                      <span className="text-[15px] font-bold text-slate-900 tabular-nums">{num(r.count)}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                          r.flag ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/12 text-emerald-600',
                        )}
                      >
                        {r.flag ? m.security.review : m.security.clear}
                      </span>
                    </li>
                  ))}
                </ul>
              </PremiumPanel>
            </div>
          </div>

          {/* ── Shortcuts ────────────────────────────────────────────────────── */}
          <PremiumPanel title={m.shortcuts}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {QUICK_LINKS.map((q) => {
                const ql = m.quickLinks[q.key];
                return (
                  <Link
                    key={q.href}
                    href={q.href as never}
                    title={ql.desc}
                    className="group flex items-center gap-3 rounded-2xl border border-hairline px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-brand-500/[0.05]"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-700">
                      <q.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800">{ql.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">{ql.desc}</span>
                    </span>
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-brand-600 ltr:rotate-180" />
                  </Link>
                );
              })}
            </div>
          </PremiumPanel>
        </>
      )}
    </div>
  );
}
