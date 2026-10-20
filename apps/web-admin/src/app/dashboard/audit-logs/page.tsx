import Link from 'next/link';
import { Activity, Clock, Eye, Pencil, Plus, ScrollText, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, Paged, UserRole } from '@/lib/types';
import { formatDateTime, intlLocale } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getCompanyTimeZone } from '@/lib/currency';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { AuditFilterBar } from './_components/audit-filter-bar';
import { areaLabel } from '../operations/_area-label';
import { PremiumPageHero, PremiumPanel, PremiumEmptyState } from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  q?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 25;

// ── Event / area helpers ──────────────────────────────────────────────────────

function eventLabel(
  action: string,
  entityType: string,
  labels: ReturnType<typeof uiT>['auditLogsPage']['eventLabels'],
  domain: Record<string, string> = {},
): string {
  // A named action ("deposit.reversed") — not an HTTP method.
  if (action.includes('.')) return domain[action] ?? action.replace(/[._-]+/g, ' ');
  const m  = action.toUpperCase();
  const et = entityType.toLowerCase();
  const c  = (kw: string) => et.includes(kw);
  const is = (methods: string[]) => methods.includes(m);

  if (c('auth'))          return is(['POST']) ? labels.authPost : labels.authOther;
  if (c('permission'))    return is(['POST', 'PATCH', 'PUT']) ? labels.permissionChange : labels.permissionOther;
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
    if (is(['POST']))   return labels.documentCreate;
    if (is(['DELETE'])) return labels.documentDelete;
  }
  if (c('visit')) {
    if (is(['POST']))         return labels.visitCreate;
    if (is(['PATCH', 'PUT'])) return labels.visitEdit;
  }
  if (c('notification')) return labels.notificationSend;

  if (is(['POST']))         return labels.recordCreate;
  if (is(['PATCH', 'PUT'])) return labels.recordEdit;
  if (is(['DELETE']))       return labels.recordDelete;
  return labels.systemAction;
}


function formatIpLabel(ip: string | null, localLabel: string): { label: string; isLocal: boolean } {
  if (!ip) return { label: '—', isLocal: false };
  if (ip === '::1' || ip === '127.0.0.1' || ip.toLowerCase() === 'localhost' || ip.startsWith('::ffff:127.')) {
    return { label: localLabel, isLocal: true };
  }
  return { label: ip, isLocal: false };
}

type Kind = 'create' | 'edit' | 'delete' | 'special';
function actionKind(action: string): Kind {
  switch (action.toUpperCase()) {
    case 'POST':   return 'create';
    case 'PATCH':
    case 'PUT':    return 'edit';
    case 'DELETE': return 'delete';
    default:       return 'special';
  }
}

const KIND_ICON: Record<Kind, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  special: Sparkles,
};
const KIND_RING: Record<Kind, string> = {
  create:  'bg-emerald-500/12 text-emerald-600 ring-1 ring-inset ring-emerald-500/25',
  edit:    'bg-amber-500/12 text-amber-600 ring-1 ring-inset ring-amber-500/25',
  delete:  'bg-danger-500/12 text-danger-600 ring-1 ring-inset ring-danger-500/25',
  special: 'bg-sky-500/12 text-sky-600 ring-1 ring-inset ring-sky-500/25',
};
const KIND_BAR: Record<Kind, string> = {
  create: 'bg-emerald-500',
  edit: 'bg-amber-400',
  delete: 'bg-danger-500',
  special: 'bg-sky-500',
};

const ROLE_CHIP: Partial<Record<UserRole, string>> = {
  ADMIN:                  'bg-brand-500/12 text-brand-700',
  SALES_MANAGER:          'bg-sky-500/12 text-sky-600',
  SALES:                  'bg-emerald-500/12 text-emerald-600',
  MAINTENANCE_SUPERVISOR: 'bg-orange-500/12 text-orange-600',
  CUSTOMER:               'bg-teal-500/12 text-teal-600',
  BROKER:                 'bg-indigo-500/12 text-indigo-600',
};

function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [sp, locale, timeZone] = await Promise.all([searchParams, getLocale(), getCompanyTimeZone()]);
  const t = uiT(locale);
  const m = t.auditLogsPage;
  const l = m.list;
  const num = (n: number) => n.toLocaleString(intlLocale(locale));

  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const k of ['actorId', 'action', 'entityType', 'q', 'from', 'to'] as const) {
    if (sp[k]) qs.set(k, sp[k]!);
  }

  const res  = await safe(api.get<Paged<AuditLogItem>>(`/audit-logs?${qs.toString()}`));
  const rows = res.data?.data ?? [];
  const meta = res.data?.meta;
  const total = meta?.total ?? rows.length;

  const hasFilter = !!(sp.q || sp.action || sp.entityType || sp.actorId || sp.from || sp.to);

  // The page's actions by kind, and what deserves a look.
  const kinds: Record<Kind, number> = { create: 0, edit: 0, delete: 0, special: 0 };
  for (const r of rows) kinds[actionKind(r.action)]++;
  const kindRows = (Object.keys(kinds) as Kind[]).filter((k) => kinds[k] > 0);
  const authCount = rows.filter((r) => r.entityType.toLowerCase().includes('auth')).length;
  const sensitive = kinds.delete + authCount;

  // Days and times in the company's time zone.
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(intlLocale(locale), { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(intlLocale(locale), { timeZone, hour: 'numeric', minute: '2-digit' });
  const today = dayKey.format(new Date());
  const yesterday = dayKey.format(new Date(Date.now() - 86_400_000));
  const days: Array<{ key: string; label: string; rows: AuditLogItem[] }> = [];
  for (const r of rows) {
    const key = dayKey.format(new Date(r.createdAt));
    const last = days.at(-1);
    if (last?.key === key) last.rows.push(r);
    else {
      const label = key === today ? l.today : key === yesterday ? l.yesterday : dayFmt.format(new Date(r.createdAt));
      days.push({ key, label, rows: [r] });
    }
  }

  const relative = (iso: string): string => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    const rt = t.operationsPage.relativeTime;
    if (mins < 1) return rt.now;
    if (mins < 60) return rt.minutes(mins);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return rt.hours(hrs);
    return rt.days(Math.floor(hrs / 24));
  };

  const from = meta ? (meta.page - 1) * meta.pageSize + 1 : 1;
  const to = from + rows.length - 1;

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbSelf },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-[11px] font-bold text-brand-700">
            <ScrollText className="h-3.5 w-3.5" />
            {m.systemLogBadge}
          </span>
        }
      />

      {res.error && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">
          {m.errorLoad}{res.error}
        </div>
      )}

      {/* ── Summary ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard testId="audit-total" icon={<ScrollText />} label={l.total}>
          <p className="num text-[34px] font-semibold leading-none text-slate-900">{num(total)}</p>
          <p className="mt-2 text-[12px] text-slate-500">{hasFilter ? l.totalFiltered : l.totalAll}</p>
        </SummaryCard>

        <SummaryCard testId="audit-last" icon={<Clock />} label={l.lastActivity}>
          <p className="text-[20px] font-bold leading-tight text-slate-900">{rows[0] ? relative(rows[0].createdAt) : '—'}</p>
          {rows[0] && <p className="mt-2 truncate text-[12px] text-slate-500">{formatDateTime(rows[0].createdAt, locale, timeZone)}</p>}
        </SummaryCard>

        <SummaryCard testId="audit-kinds" icon={<Activity />} label={l.onPage}>
          {kindRows.length === 0 ? (
            <p className="text-[20px] font-bold text-slate-900">—</p>
          ) : (
            <>
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                {kindRows.map((k) => (
                  <span key={k} className={cn('h-full', KIND_BAR[k])} style={{ width: `${(kinds[k] / rows.length) * 100}%` }} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px]">
                {kindRows.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className={cn('h-2 w-2 rounded-full', KIND_BAR[k])} />
                    {l.kinds[k]}
                    <b className="text-slate-900 tabular-nums">{num(kinds[k])}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </SummaryCard>

        <SummaryCard
          testId="audit-sensitive"
          icon={sensitive > 0 ? <ShieldAlert /> : <ShieldCheck />}
          label={l.sensitive}
          tone={sensitive > 0 ? 'warn' : 'good'}
        >
          <p className="num text-[34px] font-semibold leading-none text-slate-900">{num(sensitive)}</p>
          <p className="mt-2 text-[12px] text-slate-500">{sensitive > 0 ? l.sensitiveSub : l.sensitiveNone}</p>
        </SummaryCard>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <AuditFilterBar
        defaultQ={sp.q ?? ''}
        defaultAction={sp.action ?? ''}
        defaultEntityType={sp.entityType ?? ''}
        defaultActorId={sp.actorId ?? ''}
        defaultFrom={sp.from ?? ''}
        defaultTo={sp.to ?? ''}
        locale={locale}
      />

      {/* ── The log, by day ────────────────────────────────────────────────── */}
      <PremiumPanel
        title={m.sectionTitle}
        trailing={
          rows.length > 0 ? (
            <span className="rounded-full border border-hairline px-3 py-1 text-[12px] font-semibold text-slate-500 tabular-nums">
              {l.showing(from, to, total)}
            </span>
          ) : undefined
        }
        padding="none"
      >
        {rows.length === 0 ? (
          <PremiumEmptyState
            icon={<ScrollText />}
            title={hasFilter ? m.empty.filteredTitle : m.empty.defaultTitle}
            description={hasFilter ? m.empty.filteredDesc : m.empty.defaultDesc}
            action={
              hasFilter ? (
                <Link href="/dashboard/audit-logs">
                  <Button variant="outline" size="sm">{m.empty.clearFilters}</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div data-testid="audit-days">
            {days.map((day) => (
              <section key={day.key} className="border-t border-hairline">
                <header className="flex items-center justify-between gap-3 bg-surface-muted/50 px-6 py-2.5">
                  <h3 className="text-[13px] font-bold text-slate-800">{day.label}</h3>
                  <span className="text-[11.5px] text-slate-500">{l.events(day.rows.length)}</span>
                </header>
                <ul className="divide-y divide-hairline">
                  {day.rows.map((row) => {
                    const kind = actionKind(row.action);
                    const Icon = KIND_ICON[kind];
                    const ip = formatIpLabel(row.ip, m.localIp);
                    return (
                      <li key={row.id} data-testid="audit-row">
                        <Link
                          href={`/dashboard/audit-logs/${row.id}`}
                          aria-label={m.viewEventAriaLabel}
                          className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-brand-500/[0.04]"
                        >
                          <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full', KIND_RING[kind])}>
                            <Icon className="h-4 w-4" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[14px] font-semibold text-slate-900">
                                {eventLabel(row.action, row.entityType, m.eventLabels, t.operationsPage.domainActions)}
                              </p>
                              <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-slate-500" title={row.entityType}>
                                {areaLabel(row.entityType, t.operationsPage.areaLabels)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
                              <span
                                aria-hidden
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-600/20 text-[9px] font-bold text-brand-700 ring-1 ring-inset ring-brand-500/30"
                              >
                                {initials(row.actor?.fullName ?? l.system)}
                              </span>
                              <span className="font-medium text-slate-700">{row.actor?.fullName ?? l.system}</span>
                              {row.actor && (
                                <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', ROLE_CHIP[row.actor.role] ?? 'bg-slate-500/10 text-slate-600')}>
                                  {m.roleLabels[row.actor.role] ?? row.actor.role}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                            <span className="text-[13px] font-semibold text-slate-700 tabular-nums">{timeFmt.format(new Date(row.createdAt))}</span>
                            {ip.label !== '—' && (
                              <span className="rounded-md bg-surface-muted px-1.5 py-px font-mono text-[10.5px] text-slate-500" dir="ltr" title={row.ip ?? ''}>
                                {ip.label}
                              </span>
                            )}
                          </div>
                          <span className="sm:hidden text-[12px] text-slate-500 tabular-nums">{timeFmt.format(new Date(row.createdAt))}</span>
                          <Eye className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PremiumPanel>

      {meta && meta.total > meta.pageSize && (
        <Pagination
          basePath="/dashboard/audit-logs"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          params={{
            actorId: sp.actorId,
            action: sp.action,
            entityType: sp.entityType,
            q: sp.q,
            from: sp.from,
            to: sp.to,
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, children, tone = 'neutral', testId,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn';
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex flex-col gap-4 rounded-[20px] border bg-surface p-5',
        tone === 'warn' ? 'border-amber-500/40' : tone === 'good' ? 'border-emerald-500/25' : 'border-hairline',
      )}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
        <span className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5',
          tone === 'warn' ? 'bg-amber-500/15 text-amber-600' : tone === 'good' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-brand-500/12 text-brand-700',
        )}>
          {icon}
        </span>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
