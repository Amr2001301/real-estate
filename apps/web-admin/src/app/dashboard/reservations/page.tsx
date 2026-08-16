import Link from 'next/link';
import {
  Plus, BookmarkCheck, Clock, CheckCircle2,
  XCircle, CalendarX2, AlertCircle, SlidersHorizontal,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import type { Paged, Reservation } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { salesActorLabel } from '@/lib/sales-actor';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/table';
import { ReservationStatusBadge, ReservationBookingPaymentBadge } from '@/components/badges';
import { ReservationActions } from './_components/reservation-actions';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
} from '@/components/premium';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
}

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

interface SalesUser {
  id: string;
  fullName: string;
  role?: 'SALES' | 'SALES_MANAGER';
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    projectId?: string;
    salesId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    showFilters?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const hasAdvancedFilters = !!(sp.salesId || sp.dateFrom || sp.dateTo);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      status: sp.status, projectId: sp.projectId, q: sp.q,
      salesId: sp.salesId, dateFrom: sp.dateFrom, dateTo: sp.dateTo,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const qs = p.toString();
    return `/dashboard/reservations${qs ? `?${qs}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.status) qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.salesId) qs.set('salesId', sp.salesId);
  if (sp.q) qs.set('q', sp.q);
  if (sp.dateFrom) qs.set('dateFrom', sp.dateFrom);
  if (sp.dateTo) qs.set('dateTo', sp.dateTo);

  const [statsRes, reservationsRes, projectsRes, salesRes, currency, locale] = await Promise.all([
    safe(api.get<Stats>('/reservations/stats')),
    safe(api.get<Paged<Reservation>>(`/reservations?${qs}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
    getReportsCurrency(),
    getLocale(),
  ]);
  const m = uiT(locale).pages.reservations;
  const symbol = currencySymbol(currency);

  const stats = statsRes.data;
  const reservations = reservationsRes.data?.data ?? [];
  const paginationMeta = reservationsRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];
  const salesOptions: SalesUser[] = salesRes.data?.data ?? [];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <Link href="/dashboard/reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.addBtn}
            </Button>
          </Link>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={5}
        metrics={[
          { label: m.kpi.total,           value: stats?.total   ?? '—', icon: <BookmarkCheck />, tone: 'neutral', primary: true },
          { label: m.kpi.underReview,     value: stats?.pending  ?? '—', icon: <Clock />,         tone: 'warning' },
          { label: m.kpi.approved,        value: stats?.approved ?? '—', icon: <CheckCircle2 />,  tone: 'success' },
          { label: m.kpi.rejected,        value: stats?.rejected ?? '—', icon: <XCircle />,       tone: 'danger'  },
          { label: m.kpi.cancelledExpired, value: (stats?.expired ?? 0) + (stats?.cancelled ?? 0), icon: <CalendarX2 />, tone: 'info' },
        ]}
      />

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/reservations">
        {/* Preserve advanced filter values when panel is collapsed */}
        {!showFilters && sp.salesId  && <input type="hidden" name="salesId"  value={sp.salesId} />}
        {!showFilters && sp.dateFrom && <input type="hidden" name="dateFrom" value={sp.dateFrom} />}
        {!showFilters && sp.dateTo   && <input type="hidden" name="dateTo"   value={sp.dateTo} />}

        {/* Search — flex-1 to fill available space */}
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="res-q" className="sr-only">{m.filter.searchLabel}</label>
          <Input
            id="res-q"
            name="q"
            inputSize="sm"
            defaultValue={sp.q ?? ''}
            placeholder={m.filter.searchPlaceholder}
            className="w-full"
          />
        </div>

        <PremiumFilterField label={m.filter.statusLabel} htmlFor="res-status">
          <Select id="res-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
            <option value="">{m.filter.allStatuses}</option>
            <option value="PENDING">{m.filter.pending}</option>
            <option value="APPROVED">{m.filter.approved}</option>
            <option value="REJECTED">{m.filter.rejected}</option>
            <option value="CANCELLED">{m.filter.cancelled}</option>
            <option value="EXPIRED">{m.filter.expired}</option>
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label={uiT(locale).pages.units.filter.projectLabel} htmlFor="res-projectId">
          <Select id="res-projectId" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
            <option value="">{uiT(locale).common.allProjects}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>

        {/* Action buttons — before advanced panel so they stay in row 1 */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {(sp.q || sp.status || sp.projectId || hasAdvancedFilters) && (
            <Link href="/dashboard/reservations">
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 rounded-lg px-2.5 py-1.5 border transition-colors ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:border-hairline hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? m.filter.advancedHide : m.filter.advancedShow}
            {hasAdvancedFilters && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">!</span>
            )}
          </Link>
        </div>

        {/* Advanced panel — basis-full forces row 2 */}
        {showFilters && (
          <div className="w-full basis-full border-t border-hairline pt-3.5 mt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">{m.filter.agentLabel}</label>
                <Select name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">{m.filter.allAgents}</option>
                  {salesOptions.map((s) => (
                    <option key={s.id} value={s.id}>{salesActorLabel(s)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">{m.filter.dateFrom}</label>
                <Input name="dateFrom" type="date" inputSize="sm" defaultValue={sp.dateFrom ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">{m.filter.dateTo}</label>
                <Input name="dateTo" type="date" inputSize="sm" defaultValue={sp.dateTo ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {reservationsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{reservationsRes.error}</p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <DataTable
        rowKey={(r) => r.id}
        rows={reservations}
        emptyMessage={m.empty}
        columns={[
          {
            key: 'number',
            header: m.cols.id,
            cell: (r) => (
              <Link
                href={`/dashboard/reservations/${r.id}`}
                title={m.detailTitle}
                className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
              >
                {r.reservationNumber ?? r.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            key: 'client',
            header: m.cols.client,
            cell: (r) => {
              const name = r.client?.fullName ?? r.lead?.fullName ?? '—';
              const phone = r.client?.phone ?? r.lead?.phone ?? '';
              return (
                <div>
                  <p className="font-medium text-slate-900">{name}</p>
                  {phone && <p className="text-xs text-slate-500">{phone}</p>}
                </div>
              );
            },
          },
          {
            key: 'project',
            header: m.cols.project,
            cell: (r) => {
              const project = r.unit?.building?.phase?.project;
              return (
                <div>
                  <p>{project ? tx(project.name) : '—'}</p>
                  {r.unit && <p className="text-xs text-slate-500">{m.unitPrefix} {r.unit.code}</p>}
                </div>
              );
            },
          },
          {
            key: 'sales',
            header: m.cols.agent,
            cell: (r) => r.sales?.fullName ?? '—',
          },
          {
            key: 'booking',
            header: m.cols.amount,
            cell: (r) => {
              const amount = Number(r.bookingAmount);
              return (
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-800" dir="ltr">
                    {Number.isFinite(amount)
                      ? `${amount.toLocaleString('ar-SA')} ${symbol}`
                      : '—'}
                  </span>
                  <ReservationBookingPaymentBadge status={r.bookingPaymentStatus} locale={locale} />
                </div>
              );
            },
          },
          {
            key: 'status',
            header: m.cols.status,
            cell: (r) => <ReservationStatusBadge status={r.status} locale={locale} />,
          },
          {
            key: 'expires',
            header: m.cols.expiresAt,
            cell: (r) => <span className="text-xs">{formatDateTime(r.expiresAt)}</span>,
          },
          {
            key: 'created',
            header: m.cols.created,
            cell: (r) => formatDate(r.createdAt),
          },
          {
            key: 'actions',
            header: '',
            cell: (r) => <ReservationActions reservation={r} locale={locale} />,
          },
        ]}
      />

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {paginationMeta && paginationMeta.totalPages > 1 && (
        <Pagination
          page={paginationMeta.page}
          pageSize={paginationMeta.pageSize}
          total={paginationMeta.total}
          basePath="/dashboard/reservations"
          params={sp}
          locale={locale}
        />
      )}
    </div>
  );
}
