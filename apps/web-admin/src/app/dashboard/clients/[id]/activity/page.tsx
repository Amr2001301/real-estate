import Link from 'next/link';
import { Activity, ArrowLeft, Pencil, Phone, Mail } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { User } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface AuditLog {
  id: string;
  actorId: string | null;
  actor?: { id: string; fullName: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditPaged {
  data: AuditLog[];
  meta: { page: number; pageSize: number; total: number };
}

const PAGE_SIZE = 20;

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return parts[0]![0]! + parts[parts.length - 1]![0]!;
}

export default async function ClientActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const locale = await getLocale();
  const m = uiT(locale).pages.clientDetailPage;

  const [userRes, auditRes] = await Promise.all([
    safe(api.get<User>(`/users/${id}`)),
    safe(
      api.get<AuditPaged>(
        `/audit-logs?entityId=${id}&page=${page}&pageSize=${PAGE_SIZE}`,
      ),
    ),
  ]);

  if (userRes.error || !userRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        {m.errorLoad} {userRes.error ?? m.errorNotFound}
      </div>
    );
  }

  const u = userRes.data;
  const role = (u.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT') as
    | 'CLIENT'
    | 'CUSTOMER';
  const items = auditRes.data?.data ?? [];
  const total = auditRes.data?.meta.total ?? 0;

  const ACTION_LABEL: Record<string, string> = {
    POST: m.activityActionCreate,
    PATCH: m.activityActionUpdate,
    PUT: m.activityActionUpdate,
    DELETE: m.activityActionDelete,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`${m.activityPageTitle}: ${u.fullName}`}
        description={m.activityPageDesc}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbClients, href: `/dashboard/clients?role=${role}` },
          { label: u.fullName, href: `/dashboard/clients/${id}` },
          { label: m.activityTimelineTitle },
        ]}
        actions={
          <Link href={`/dashboard/clients/${id}/edit` as never}>
            <Button
              variant="outline"
              size="md"
              leftIcon={<Pencil className="h-4 w-4" />}
            >
              {m.btnEdit}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                {m.activityTimelineTitle}
              </h2>
              <span className="ms-auto text-2xs font-semibold text-slate-500">
                {total} {m.activityTotalSuffix}
              </span>
            </div>

            <div className="mt-5">
              {items.length === 0 ? (
                <EmptyState
                  icon={<Activity />}
                  title={m.activityEmptyTitle}
                  description={m.activityEmptyDesc}
                />
              ) : (
                <ol className="relative ms-4 border-s-2 border-hairline ps-6 space-y-5">
                  {items.map((a) => (
                    <ActivityItem
                      key={a.id}
                      entry={a}
                      actionLabels={ACTION_LABEL}
                      byLabel={m.activityByLabel}
                      systemLabel={m.activitySystem}
                    />
                  ))}
                </ol>
              )}
            </div>
          </Card>

          {auditRes.data && total > PAGE_SIZE && (
            <Pagination
              page={auditRes.data.meta.page}
              pageSize={auditRes.data.meta.pageSize}
              total={total}
              basePath={`/dashboard/clients/${id}/activity`}
            />
          )}
        </div>

        <div className="space-y-6">
          {/* Mini profile card */}
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold uppercase shrink-0 ring-2 ring-white shadow-sm',
                  paletteFor(u.fullName ?? u.id),
                )}
              >
                {initials(u.fullName)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {u.fullName}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  <Badge
                    tone={role === 'CUSTOMER' ? 'success' : 'info'}
                    variant="soft"
                    size="sm"
                  >
                    {role === 'CUSTOMER' ? m.roleBadgeOwner : m.roleBadgeBrowser}
                  </Badge>
                </p>
              </div>
            </div>

            <dl className="mt-4 flex flex-col gap-2.5 text-sm">
              {u.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`mailto:${u.email}`}
                    className="text-slate-700 hover:text-brand-700 truncate"
                    dir="ltr"
                  >
                    {u.email}
                  </a>
                </div>
              )}
              {u.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`tel:${u.phone}`}
                    className="font-mono text-slate-700 hover:text-brand-700"
                    dir="ltr"
                  >
                    {u.phone}
                  </a>
                </div>
              )}
            </dl>

            <div className="mt-4 pt-4 border-t border-hairline">
              <Link
                href={`/dashboard/clients/${id}` as never}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                {m.backToProfile}
              </Link>
            </div>
          </Card>

          {/* Quick stats */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">
              {m.quickSummaryTitle}
            </h3>
            <dl className="space-y-2.5 text-sm">
              <StatRow label={m.summaryTotalOps} value={<span className="tabular-nums font-semibold text-slate-900">{total}</span>} />
              <StatRow
                label={m.summaryRegistered}
                value={<span className="text-slate-700">{formatDate(u.createdAt)}</span>}
              />
              <StatRow
                label={m.summaryLastLogin}
                value={
                  <span className="text-slate-700">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                  </span>
                }
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-2xs uppercase tracking-wide text-slate-500 font-semibold">
        {label}
      </dt>
      <dd className="text-end">{value}</dd>
    </div>
  );
}

function ActivityItem({
  entry,
  actionLabels,
  byLabel,
  systemLabel,
}: {
  entry: AuditLog;
  actionLabels: Record<string, string>;
  byLabel: string;
  systemLabel: string;
}) {
  const tone =
    entry.action === 'POST'
      ? 'success'
      : entry.action === 'DELETE'
        ? 'danger'
        : 'brand';
  const dotClass: Record<typeof tone, string> = {
    success: 'bg-success-100 text-success-700 ring-success-200',
    danger: 'bg-danger-100 text-danger-700 ring-danger-200',
    brand: 'bg-brand-100 text-brand-700 ring-brand-200',
  };
  const label = actionLabels[entry.action] ?? entry.action;
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -start-[33px] top-1 inline-flex h-7 w-7 items-center justify-center rounded-full ring-2',
          dotClass[tone],
        )}
      >
        <Activity className="h-3.5 w-3.5" />
      </span>
      <div className="rounded-xl bg-surface-muted/40 ring-1 ring-inset ring-hairline px-3.5 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-900">
              <span className="font-semibold">{label}</span>{' '}
              <span className="font-mono text-xs text-slate-500">{entry.entityType}</span>
            </p>
            <p className="mt-1 text-2xs text-slate-500">
              {byLabel}{' '}
              <span className="font-medium text-slate-700">
                {entry.actor?.fullName ?? systemLabel}
              </span>
              {entry.actor?.role && (
                <span className="ms-2 inline-block font-mono text-slate-400">
                  ({entry.actor.role})
                </span>
              )}
              {entry.ip && (
                <span className="ms-2 inline-block font-mono text-slate-400" dir="ltr">
                  {entry.ip}
                </span>
              )}
            </p>
          </div>
          <time className="shrink-0 text-2xs text-slate-500 tabular-nums whitespace-nowrap">
            {formatDateTime(entry.createdAt)}
          </time>
        </div>
      </div>
    </li>
  );
}
