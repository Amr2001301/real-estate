import Link from 'next/link';
import { Plus, BookmarkCheck, AlertCircle, SlidersHorizontal, Phone, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions, staffOptions } from '@/lib/options';
import { getLocale } from '@/lib/locale';
import type { Paged, Reservation } from '@/lib/types';
import { formatDate, formatTime, tx, intlLocale, DEFAULT_TIME_ZONE } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { salesActorLabel } from '@/lib/sales-actor';
import { Pagination } from '@/components/ui/pagination';
import { ReservationStatusBadge, ReservationBookingPaymentBadge } from '@/components/badges';
import { ReservationActions } from './_components/reservation-actions';
import { getSession } from '@/lib/session';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { EntityLink } from '@/components/entity-link';

export const dynamic = 'force-dynamic';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
  overdue?: number;
}

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

interface SalesUser {
  id: string;
  fullName: string;
  role?: string;
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
  // OVERDUE is a view, not a status: open reservations past expiry (booking paid).
  if (sp.status === 'OVERDUE') qs.set('overdue', 'true');
  else if (sp.status) qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.salesId) qs.set('salesId', sp.salesId);
  if (sp.q) qs.set('q', sp.q);
  if (sp.dateFrom) qs.set('dateFrom', sp.dateFrom);
  if (sp.dateTo) qs.set('dateTo', sp.dateTo);

  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const isManager = session?.role === 'SALES_MANAGER';
  const [statsRes, reservationsRes, projectsRes, salesRes, currency, locale] = await Promise.all([
    safe(api.get<Stats>('/reservations/stats')),
    safe(api.get<Paged<Reservation>>(`/reservations?${qs}`)),
    safe(projectOptions()),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    getReportsCurrency(),
    getLocale(),
  ]);
  const m = uiT(locale).pages.reservations;
  const symbol = currencySymbol(currency, locale);

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

      {/* ── Figures ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={5}
          figures={[
            { label: m.kpi.total, value: stats?.total ?? '—', href: '/dashboard/reservations' },
            { label: m.kpi.underReview, value: stats?.pending ?? '—', href: '/dashboard/reservations?status=PENDING', warn: (stats?.pending ?? 0) > 0 },
            { label: m.kpi.approved, value: stats?.approved ?? '—', href: '/dashboard/reservations?status=APPROVED' },
            { label: m.kpi.rejected, value: stats?.rejected ?? '—', href: '/dashboard/reservations?status=REJECTED' },
            { label: m.kpi.cancelledExpired, value: stats ? (stats.expired ?? 0) + (stats.cancelled ?? 0) : '—' },
          ]}
        />
      </section>

      {(stats?.overdue ?? 0) > 0 && sp.status !== 'OVERDUE' && (
        <div
          data-testid="overdue-reservations-banner"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-[13px] text-warning-700"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {m.overdueBanner(stats!.overdue!)}
          </span>
          <Link href={pageUrl({ status: 'OVERDUE', page: undefined })} className="font-semibold underline">
            {m.overdueLink}
          </Link>
        </div>
      )}

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
            <option value="OVERDUE">{m.filter.overdue}</option>
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

      {/* ── Rows ─────────────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        title={m.title}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {(paginationMeta?.total ?? reservations.length).toLocaleString(intlLocale(locale))} {m.countSuffix}
          </span>
        }
      >
        {reservations.length === 0 ? (
          <PremiumEmptyState icon={<BookmarkCheck />} title={m.empty} />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="reservation-rows">
            {reservations.map((r) => {
              const name = r.client?.fullName ?? r.lead?.fullName ?? '—';
              const project = r.unit?.building?.phase?.project;
              const amount = Number(r.bookingAmount);
              const href = `/dashboard/reservations/${r.id}`;
              return (
                <li
                  key={r.id}
                  data-testid="reservation-row"
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_130px_190px_170px]"
                >
                  <Avatar name={name} />

                  {/* Client + reservation code */}
                  <div className="min-w-0">
                    <Link href={href as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                      <Link href={href as never} data-testid="list-code" className="whitespace-nowrap hover:text-brand-700">
                        <span className="me-1 text-slate-400">{m.reservationWord}</span>
                        <span className="font-mono font-semibold text-brand-700" dir="ltr">
                          {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </Link>
                      {(r.client?.phone ?? r.lead?.phone) && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{r.client?.phone ?? r.lead?.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project + unit */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{project ? <EntityLink kind="project" id={project.id} mono={false}>{tx(project.name)}</EntityLink> : '—'}</p>
                      {r.unit && (
                        <p className="mt-0.5 text-slate-500">
                          <span className="me-1 text-slate-400">{m.unitWord}</span>
                          <EntityLink kind="unit" id={r.unit.id} className="whitespace-nowrap">{r.unit.code}</EntityLink>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Agent + created */}
                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    <p className={cn('truncate font-semibold', r.sales ? 'text-slate-800' : 'text-slate-400')}>
                      {r.sales?.fullName ?? m.noAgent}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-slate-500">
                      {m.createdOn} {formatDate(r.createdAt, locale)}
                    </p>
                  </div>

                  {/* Booking amount + payment */}
                  <div className="hidden flex-col items-start gap-1 lg:flex">
                    <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">
                      {Number.isFinite(amount)
                        ? <>{amount.toLocaleString(intlLocale(locale))} <span className="text-[11px] font-semibold text-slate-500">{symbol}</span></>
                        : '—'}
                    </span>
                    <ReservationBookingPaymentBadge status={r.bookingPaymentStatus} locale={locale} />
                  </div>

                  {/* Status + expiry */}
                  <div className="hidden flex-col items-start gap-1 lg:flex">
                    <ReservationStatusBadge status={r.status} locale={locale} />
                    <span className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">
                      {m.expiresOn} {formatDate(r.expiresAt, locale, DEFAULT_TIME_ZONE)} · <span dir="ltr">{formatTime(r.expiresAt, locale)}</span>
                    </span>
                  </div>

                  <ReservationActions
                    reservation={r}
                    canDecide={isAdmin || (isManager && r.salesId !== session?.id)}
                    locale={locale}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </PremiumSectionCard>

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
