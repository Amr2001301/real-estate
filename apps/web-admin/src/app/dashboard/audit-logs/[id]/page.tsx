import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  ScrollText, Activity, ArrowRightLeft,
  Plus, Pencil, Trash2, Shield, Clock, Info, Lock, User,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, UserRole } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Role badge colors ─────────────────────────────────────────────────────────

const ROLE_BADGE_CLS: Record<UserRole, string> = {
  ADMIN:                  'bg-purple-100 text-purple-700',
  SALES_MANAGER:          'bg-blue-100   text-blue-700',
  SALES:                  'bg-brand-100  text-brand-700',
  MAINTENANCE_SUPERVISOR: 'bg-orange-100 text-orange-700',
  CLIENT:                 'bg-slate-100  text-slate-600',
  CUSTOMER:               'bg-teal-100   text-teal-700',
  BROKER:                 'bg-indigo-100 text-indigo-700',
};

// ── Human-readable helpers ────────────────────────────────────────────────────

function eventLabel(action: string, entityType: string, labels: ReturnType<typeof uiT>['auditLogsPage']['eventLabels']): string {
  const mt = action.toUpperCase();
  const et = entityType.toLowerCase();
  const c  = (kw: string) => et.includes(kw);
  const is = (methods: string[]) => methods.includes(mt);

  if (c('auth'))        return is(['POST']) ? labels.authPost : labels.authOther;
  if (c('permission'))  return is(['POST', 'PATCH', 'PUT']) ? labels.permissionChange : labels.permissionOther;
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

function areaLabel(entityType: string, labels: ReturnType<typeof uiT>['auditLogsPage']['areaLabels']): string {
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
  if (et.includes('audit'))             return labels.audit;
  return entityType;
}

function areaBadgeCls(entityType: string): string {
  const et = entityType.toLowerCase();
  if (et.includes('auth'))        return 'bg-purple-50 text-purple-700 border border-purple-200';
  if (et.includes('permission'))  return 'bg-brand-50  text-brand-700  border border-brand-200';
  if (et.includes('user'))        return 'bg-blue-50   text-blue-700   border border-blue-200';
  if (et.includes('contract'))    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (et.includes('payment'))     return 'bg-amber-50  text-amber-700  border border-amber-200';
  if (et.includes('reservation')) return 'bg-teal-50   text-teal-700   border border-teal-200';
  if (et.includes('broker'))      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  if (et.includes('maintenance')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (et.includes('document'))    return 'bg-slate-50  text-slate-600  border border-slate-200';
  if (et.includes('project'))     return 'bg-violet-50 text-violet-700 border border-violet-200';
  if (et.includes('unit'))        return 'bg-cyan-50   text-cyan-700   border border-cyan-200';
  if (et.includes('lead'))        return 'bg-rose-50   text-rose-700   border border-rose-200';
  return 'bg-slate-50 text-slate-600 border border-slate-200';
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

function methodTopBorderCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'border-t-[3px] border-t-success-500';
    case 'PATCH':
    case 'PUT':    return 'border-t-[3px] border-t-amber-400';
    case 'DELETE': return 'border-t-[3px] border-t-danger-500';
    default:       return 'border-t-[3px] border-t-slate-200';
  }
}

function actionIcon(action: string, entityType: string): ReactNode {
  const et = entityType.toLowerCase();
  if (et.includes('auth') || et.includes('permission')) return <Shield className="h-5 w-5" />;
  switch (action.toUpperCase()) {
    case 'POST':   return <Plus className="h-5 w-5" />;
    case 'PATCH':
    case 'PUT':    return <Pencil className="h-5 w-5" />;
    case 'DELETE': return <Trash2 className="h-5 w-5" />;
    default:       return <Activity className="h-5 w-5" />;
  }
}

function formatIpLabel(ip: string | null, localLabel: string): { label: string; isLocal: boolean } {
  if (!ip) return { label: '—', isLocal: false };
  if (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.toLowerCase() === 'localhost' ||
    ip.startsWith('::ffff:127.')
  ) {
    return { label: localLabel, isLocal: true };
  }
  return { label: ip, isLocal: false };
}

// ── Change-diff helpers ───────────────────────────────────────────────────────

function isRedactedValue(v: unknown): boolean {
  return typeof v === 'string' && v.includes('REDACTED');
}

function formatFieldValue(v: unknown, m: ReturnType<typeof uiT>['auditLogDetail']): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? m.boolTrue : m.boolFalse;
  if (Array.isArray(v)) return m.arrayCount(v.length);
  if (typeof v === 'object') return m.complexData;
  const s = String(v);
  return m.enumLabels[s] ?? s;
}

interface DiffRow   { key: string; before: string; after: string; beforeRedacted: boolean; afterRedacted: boolean }
interface ScalarRow { key: string; value: string; redacted: boolean }
interface KeyRow    { key: string; summary: string; redacted: boolean }

function computeDiff(before: unknown, after: unknown, m: ReturnType<typeof uiT>['auditLogDetail']): DiffRow[] | null {
  if (typeof before !== 'object' || typeof after !== 'object') return null;
  if (!before || !after) return null;
  const b = before as Record<string, unknown>;
  const a = after  as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const diffs: DiffRow[] = [];
  for (const key of allKeys) {
    const bv = formatFieldValue(b[key], m);
    const av = formatFieldValue(a[key], m);
    if (bv !== av) diffs.push({
      key,
      before: bv, after: av,
      beforeRedacted: isRedactedValue(b[key]),
      afterRedacted:  isRedactedValue(a[key]),
    });
  }
  return diffs.length > 0 ? diffs : null;
}

function extractScalars(value: unknown, m: ReturnType<typeof uiT>['auditLogDetail']): ScalarRow[] | null {
  if (typeof value !== 'object' || !value) return null;
  const obj = value as Record<string, unknown>;
  const rows = Object.entries(obj)
    .filter(([, v]) => v === null || typeof v !== 'object')
    .map(([k, v]) => ({ key: k, value: formatFieldValue(v, m), redacted: isRedactedValue(v) }));
  return rows.length > 0 ? rows : null;
}

function extractKeySummary(value: unknown, m: ReturnType<typeof uiT>['auditLogDetail']): KeyRow[] | null {
  if (typeof value !== 'object' || !value) return null;
  const obj = value as Record<string, unknown>;
  return Object.entries(obj).map(([key, v]) => ({
    key,
    summary: formatFieldValue(v, m),
    redacted: isRedactedValue(v),
  }));
}

// ── Entity navigation ─────────────────────────────────────────────────────────

const RELATED_LINK_MAP: Array<{ match: string; build: (id: string) => string }> = [
  { match: 'brokers',               build: (id) => `/dashboard/brokers/${id}` },
  { match: 'broker-users',          build: (id) => `/dashboard/brokers/${id}` },
  { match: 'broker-leads',          build: (id) => `/dashboard/broker-leads/${id}` },
  { match: 'broker-reservations',   build: (id) => `/dashboard/broker-reservations/${id}` },
  { match: 'broker-contracts',      build: (id) => `/dashboard/broker-contracts/${id}` },
  { match: 'broker-commissions',    build: (id) => `/dashboard/broker-commissions/${id}` },
  { match: 'broker-payouts',        build: (id) => `/dashboard/broker-payouts/${id}` },
  { match: 'reservations',          build: (id) => `/dashboard/reservations/${id}` },
  { match: 'contracts',             build: (id) => `/dashboard/contracts/${id}` },
];

function relatedHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  for (const { match, build } of RELATED_LINK_MAP) {
    if (entityType.endsWith(match)) return build(entityId);
  }
  return null;
}

function jsonPreview(value: unknown): string {
  if (value === null || value === undefined) return '';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const m  = uiT(locale).auditLogDetail;
  const ml = uiT(locale).auditLogsPage;

  const res = await safe(api.get<AuditLogItem>(`/audit-logs/${id}`));
  if (res.error || !res.data) notFound();
  const log = res.data;

  const link       = relatedHref(log.entityType, log.entityId);
  const beforeJson = jsonPreview(log.before);
  const afterJson  = jsonPreview(log.after);
  const ipFmt      = formatIpLabel(log.ip, m.localIp);

  const diffs        = computeDiff(log.before, log.after, m);
  const afterScalars = !diffs ? extractScalars(log.after, m) : null;
  const keySummary   = !diffs && !afterScalars ? extractKeySummary(log.after, m) : null;

  const isAuth     = log.entityType.toLowerCase().includes('auth');
  const isDelete   = log.action.toUpperCase() === 'DELETE';

  const evLabel   = eventLabel(log.action, log.entityType, ml.eventLabels);
  const arLabel   = areaLabel(log.entityType, ml.areaLabels);

  function fieldLabel(key: string): string { return m.fieldLabels[key] ?? key; }

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={evLabel}
        description={`${arLabel} · ${log.actor?.fullName ?? m.systemActor}`}
        breadcrumbs={[
          { label: m.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbLogs, href: '/dashboard/audit-logs' },
          { label: id.slice(0, 8) },
        ]}
        meta={
          <>
            <span
              className={cn(
                'inline-block px-3 py-1 rounded-xl font-mono text-xs font-bold',
                methodBadgeCls(log.action),
              )}
              dir="ltr"
            >
              {log.action}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(log.createdAt)}</span>
          </>
        }
      />

      {/* ── Hero event card ──────────────────────────────────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border border-hairline bg-surface shadow-soft overflow-hidden',
          methodTopBorderCls(log.action),
        )}
      >
        <div className="flex items-start gap-4 px-5 py-5">
          {/* Action icon */}
          <span
            className={cn(
              'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl mt-0.5',
              methodBadgeCls(log.action),
            )}
          >
            {actionIcon(log.action, log.entityType)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 leading-tight">
                  {evLabel}
                </p>
                <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                  {log.actor?.fullName ?? (
                    <span className="italic text-slate-400">{m.systemActor}</span>
                  )}
                </p>
              </div>
              <span
                className={cn(
                  'inline-block shrink-0 px-3 py-1.5 rounded-xl font-mono text-sm font-bold leading-none',
                  methodBadgeCls(log.action),
                )}
                dir="ltr"
              >
                {log.action}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Colored area badge */}
              <span
                className={cn(
                  'inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full',
                  areaBadgeCls(log.entityType),
                )}
              >
                {arLabel}
              </span>

              <span className="text-xs text-slate-500 tabular-nums">
                {formatDateTime(log.createdAt)}
              </span>

              {/* IP display */}
              {ipFmt.label !== '—' && (
                ipFmt.isLocal ? (
                  <span
                    className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-hairline"
                    title={log.ip ?? ''}
                  >
                    {ipFmt.label}
                  </span>
                ) : (
                  <span
                    className="font-mono text-xs text-slate-500 bg-slate-50 border border-hairline px-2.5 py-1 rounded-lg"
                    dir="ltr"
                  >
                    {ipFmt.label}
                  </span>
                )
              )}

              {/* High-risk notice */}
              {(isDelete || isAuth) && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full',
                  isDelete
                    ? 'bg-danger-50 text-danger-700 border border-danger-100'
                    : 'bg-purple-50 text-purple-700 border border-purple-100',
                )}>
                  <Shield className="h-3 w-3 shrink-0" />
                  {isDelete ? m.deleteEvent : m.authEvent}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entity ID footer */}
        {log.entityId && (
          <div className="border-t border-hairline bg-canvas/40 px-5 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">
              {m.entityIdLabel}
            </span>
            <span className="font-mono text-[11px] text-slate-600 flex-1 break-all" dir="ltr">
              {log.entityId}
            </span>
            {link && (
              <Link href={link as never} className="shrink-0">
                <Button variant="outline" size="sm">{m.openRecord}</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Detail layout ────────────────────────────────────────────────────── */}
      <PremiumDetailLayout
        main={
          <div className="space-y-4">

            {/* ── Event summary ───────────────────────────────────────────── */}
            <PremiumSectionCard
              icon={<Activity />}
              title={m.eventSummaryTitle}
              padded={false}
            >
              {/* Row 1: actor | event type | area */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline border-b border-hairline">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    {m.actorLabel}
                  </p>
                  {log.actor ? (
                    <div className="space-y-1.5">
                      <p className="text-[14px] font-bold text-slate-900 leading-tight">
                        {log.actor.fullName}
                      </p>
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold',
                          ROLE_BADGE_CLS[log.actor.role] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {ml.roleLabels[log.actor.role] ?? log.actor.role}
                      </span>
                      {log.actor.email && (
                        <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                          {log.actor.email}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400 shrink-0">
                        <User className="h-4 w-4" />
                      </span>
                      <span className="text-[13px] text-slate-400 italic">{m.systemActor}</span>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    {m.actionTypeLabel}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-slate-900 leading-tight">
                      {evLabel}
                    </span>
                    <span
                      className={cn(
                        'inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold',
                        methodBadgeCls(log.action),
                      )}
                      dir="ltr"
                    >
                      {log.action}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    {m.areaColLabel}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center text-[13px] font-semibold px-2.5 py-1 rounded-full',
                      areaBadgeCls(log.entityType),
                    )}
                  >
                    {arLabel}
                  </span>
                </div>
              </div>

              {/* Row 2: timestamp | IP | entity ID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    {m.executionTimeLabel}
                  </p>
                  <p className="text-[13px] font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    {m.ipLabel}
                  </p>
                  {ipFmt.isLocal ? (
                    <span className="inline-block px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-slate-100 text-slate-600">
                      {ipFmt.label}
                    </span>
                  ) : ipFmt.label !== '—' ? (
                    <span className="font-mono text-[13px] font-semibold text-slate-900" dir="ltr">
                      {ipFmt.label}
                    </span>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    {m.targetEntityLabel}
                  </p>
                  {log.entityId ? (
                    <div className="space-y-2">
                      <span
                        className="font-mono text-[11px] text-slate-600 bg-canvas border border-hairline px-2 py-1.5 rounded-md break-all inline-block"
                        dir="ltr"
                      >
                        {log.entityId}
                      </span>
                      {link && (
                        <div>
                          <Link href={link as never}>
                            <Button variant="outline" size="sm">{m.openRecord}</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── What changed? ─────────────────────────────────────────── */}
            <PremiumSectionCard
              icon={<ArrowRightLeft />}
              title={m.changesTitle}
              trailing={
                diffs ? (
                  <span className="inline-flex h-5 min-w-[28px] px-1.5 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold tabular-nums">
                    {diffs.length}
                  </span>
                ) : undefined
              }
              padded={false}
            >
              {diffs ? (
                /* Diff table — before vs after */
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                      <tr>
                        <th className="text-start py-2.5 ps-5 pe-4 whitespace-nowrap">{m.fieldCol}</th>
                        <th className="text-start py-2.5 px-4 w-[38%]">{m.beforeCol}</th>
                        <th className="text-start py-2.5 px-4 w-[38%]">{m.afterCol}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {diffs.map((d) => (
                        <tr key={d.key} className="hover:bg-canvas/40 transition-colors duration-100">
                          <td className="py-3 ps-5 pe-4 whitespace-nowrap">
                            <span className="text-[13px] font-semibold text-slate-800">{fieldLabel(d.key)}</span>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{d.key}</span>
                          </td>
                          <td className="py-3 px-4 bg-danger-50/30">
                            {d.beforeRedacted ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                {m.redacted}
                              </span>
                            ) : (
                              <span className="text-[12px] text-danger-700 line-through">{d.before}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 bg-success-50/30">
                            {d.afterRedacted ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                {m.redacted}
                              </span>
                            ) : (
                              <span className="text-[12px] text-success-700 font-semibold">{d.after}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : afterScalars ? (
                /* After-only scalars (no before snapshot) */
                <div>
                  <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50/60 border-b border-amber-100 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>{m.noBeforeNote}</span>
                  </div>
                  <div className="divide-y divide-hairline">
                    {afterScalars.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-start gap-4 px-5 py-3 hover:bg-canvas/40 transition-colors"
                      >
                        <div className="w-44 shrink-0 pt-0.5">
                          <span className="text-[13px] font-semibold text-slate-700 leading-tight">
                            {fieldLabel(f.key)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{f.key}</span>
                        </div>
                        {f.redacted ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic pt-0.5">
                            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                            {m.redacted}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-800 flex-1 pt-0.5">{f.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : keySummary ? (
                /* Key summary (nested objects) */
                <div>
                  <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50/60 border-b border-amber-100 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>{m.noBeforeNoteSummary}</span>
                  </div>
                  <div className="divide-y divide-hairline">
                    {keySummary.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-start gap-4 px-5 py-3 hover:bg-canvas/40 transition-colors"
                      >
                        <div className="w-44 shrink-0 pt-0.5">
                          <span className="text-[13px] font-semibold text-slate-700">{fieldLabel(f.key)}</span>
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{f.key}</span>
                        </div>
                        {f.redacted ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic pt-0.5">
                            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                            {m.redacted}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-500 flex-1 pt-0.5">{f.summary}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <ArrowRightLeft className="h-8 w-8 text-slate-200" />
                  <p className="text-[13px] text-slate-400">{m.noChangesDesc}</p>
                </div>
              )}
            </PremiumSectionCard>

            {/* ── Raw technical data ──────────────────────────────────────── */}
            {(beforeJson || afterJson) && (
              <PremiumSectionCard
                icon={<ScrollText />}
                title={m.rawDataTitle}
                padded={false}
              >
                {/* Technical path row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-b border-hairline bg-canvas/30">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
                    {m.technicalPath}
                  </span>
                  <span className="font-mono text-[12px] text-slate-600 flex-1" dir="ltr">
                    {log.entityType}
                  </span>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0',
                      methodBadgeCls(log.action),
                    )}
                    dir="ltr"
                  >
                    {log.action}
                  </span>
                </div>

                {/* Before collapsible */}
                <details className="border-b border-hairline">
                  <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-canvas/40 transition-colors list-none">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-danger-50 text-danger-600 text-[10px] font-bold shrink-0">
                        {m.beforeDataIcon}
                      </span>
                      <span className="text-[13px] font-semibold text-slate-700">
                        {m.beforeData}
                      </span>
                      {!beforeJson && (
                        <span className="text-[11px] text-slate-400">({m.notAvailable})</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{m.clickToExpand}</span>
                  </summary>
                  <div className="border-t border-hairline">
                    {beforeJson ? (
                      <pre
                        dir="ltr"
                        className="px-5 py-4 text-[11px] font-mono text-slate-700 leading-relaxed overflow-auto max-h-80 scrollbar-thin bg-canvas/20"
                      >
                        {beforeJson}
                      </pre>
                    ) : (
                      <p className="px-5 py-3 text-[12px] text-slate-500">
                        {m.notAvailableNote}
                      </p>
                    )}
                  </div>
                </details>

                {/* After collapsible */}
                <details>
                  <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-canvas/40 transition-colors list-none">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-success-50 text-success-600 text-[10px] font-bold shrink-0">
                        {m.afterDataIcon}
                      </span>
                      <span className="text-[13px] font-semibold text-slate-700">
                        {m.afterData}
                      </span>
                      {!afterJson && (
                        <span className="text-[11px] text-slate-400">({m.notAvailable})</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{m.clickToExpand}</span>
                  </summary>
                  <div className="border-t border-hairline">
                    {afterJson ? (
                      <pre
                        dir="ltr"
                        className="px-5 py-4 text-[11px] font-mono text-slate-700 leading-relaxed overflow-auto max-h-[28rem] scrollbar-thin bg-canvas/20"
                      >
                        {afterJson}
                      </pre>
                    ) : (
                      <p className="px-5 py-3 text-[12px] text-slate-500">{m.notAvailable}</p>
                    )}
                  </div>
                </details>
              </PremiumSectionCard>
            )}

          </div>
        }
        side={
          <div className="space-y-4">

            {/* Navigation */}
            <PremiumCommandPanel title={m.navTitle}>
              {link && (
                <Link href={link as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><Activity /></span>
                  {m.openRelatedRecord}
                </Link>
              )}
              <Link href="/dashboard/audit-logs" className={CMD_LINK}>
                <span className={CMD_ICON}><ScrollText /></span>
                {m.logsList}
              </Link>
            </PremiumCommandPanel>

            {/* Actor card */}
            <PremiumSectionCard
              icon={<User />}
              title={m.actorTitle}
              padded
            >
              {log.actor ? (
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      {m.actorNameLabel}
                    </dt>
                    <dd className="text-[14px] font-bold text-slate-900">{log.actor.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      {m.actorRoleLabel}
                    </dt>
                    <dd>
                      <span
                        className={cn(
                          'inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold',
                          ROLE_BADGE_CLS[log.actor.role] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {ml.roleLabels[log.actor.role] ?? log.actor.role}
                      </span>
                    </dd>
                  </div>
                  {log.actor.email && (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                        {m.actorEmailLabel}
                      </dt>
                      <dd className="text-[12px] font-mono text-slate-700 break-all" dir="ltr">
                        {log.actor.email}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shrink-0">
                    <User className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">{m.systemActor}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{m.actorUnknownDesc}</p>
                  </div>
                </div>
              )}
            </PremiumSectionCard>

            {/* Event details */}
            <PremiumSectionCard
              icon={<Clock />}
              title={m.eventDetailsTitle}
              padded
            >
              <dl className="flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    {m.eventAreaLabel}
                  </dt>
                  <dd>
                    <span
                      className={cn(
                        'inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full',
                        areaBadgeCls(log.entityType),
                      )}
                    >
                      {arLabel}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    {m.eventTimeLabel}
                  </dt>
                  <dd className="text-[12px] text-slate-700 tabular-nums" dir="ltr">
                    {formatDateTime(log.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    {m.eventIpLabel}
                  </dt>
                  <dd>
                    {ipFmt.isLocal ? (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[12px] font-medium">
                        {ipFmt.label}
                      </span>
                    ) : ipFmt.label !== '—' ? (
                      <span className="font-mono text-[12px] text-slate-700" dir="ltr">{ipFmt.label}</span>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </dd>
                </div>
                {log.entityId && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      {m.eventEntityLabel}
                    </dt>
                    <dd
                      className="font-mono text-[11px] text-slate-600 break-all bg-canvas border border-hairline px-2 py-1.5 rounded-md"
                      dir="ltr"
                    >
                      {log.entityId}
                    </dd>
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
