import Link from 'next/link';
import { Plus, BookmarkCheck, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions, staffOptions } from '@/lib/options';
import { getLocale } from '@/lib/locale';
import type { Paged, Project, Reservation } from '@/lib/types';
import { formatDate, tx, intlLocale, DEFAULT_TIME_ZONE } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { salesActorLabel } from '@/lib/sales-actor';
import { ReservationStatusBadge } from '@/components/badges';
import { ReservationActions } from './_components/reservation-actions';
import { getSession } from '@/lib/session';
import {
  PremiumPageHero,
  PremiumEmptyState,
} from '@/components/premium';
import { FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { AgentCell, AlertStrip, DataTable, ListFilterBar, ListFilterField, ListPage, ListPager, ListTableCard, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
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

/** «منتهية/ملغاة»: the API takes a comma-separated status list. */
const CLOSED = 'CANCELLED,EXPIRED';

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
  const pageSize = 10;

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
  const [statsRes, reservationsRes, projectsRes, salesRes, currency, locale, coverRes] = await Promise.all([
    safe(api.get<Stats>('/reservations/stats')),
    safe(api.get<Paged<Reservation>>(`/reservations?${qs}`)),
    safe(projectOptions()),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    getReportsCurrency(),
    getLocale(),
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);
  const covers = new Map((coverRes.data?.data ?? []).map((p) => [p.id, p.media?.[0]?.url]));
  const m = uiT(locale).pages.reservations;
  const symbol = currencySymbol(currency, locale);

  const stats = statsRes.data;
  const share = (n: number) => (stats?.total ? Math.round((n / stats.total) * 100) : 0);
  const ofTotal = locale === 'ar' ? 'من الإجمالي' : 'of total';
  const reservations = reservationsRes.data?.data ?? [];
  const paginationMeta = reservationsRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];
  const salesOptions: SalesUser[] = salesRes.data?.data ?? [];

  // A figure is on when the list shows exactly what it counts (no other
  // filter); clicking it again goes back to the whole list.
  const otherFilters = !!(sp.q || sp.projectId || sp.salesId || sp.dateFrom || sp.dateTo);
  const figLink = (status: string | undefined) => {
    const active = !otherFilters && (sp.status || undefined) === status;
    return {
      active,
      href: active || !status ? '/dashboard/reservations' : `/dashboard/reservations?status=${status}`,
    };
  };

  return (
    <ListPage minHeight={960}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {locale === 'ar' ? 'المبيعات / الحجوزات' : 'Sales / Reservations'}
            <span aria-hidden className="h-px w-6 bg-brand-700/40" />
          </span>
        }
        className="shrink-0"
        actions={
          <Link href="/dashboard/reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.addBtn}
            </Button>
          </Link>
        }
      />

      {/* ── Figures ──────────────────────────────────────────────────────────── */}
      <section className="shrink-0">
        <FigureBar
          variant="cards"
          cols={5}
          figures={[
            { label: m.kpi.total, value: stats?.total ?? '—', ...figLink(undefined), icon: FigIcons.total, sub: locale === 'ar' ? 'كل الحجوزات' : 'All reservations' },
            { label: m.kpi.underReview, value: stats?.pending ?? '—', ...figLink('PENDING'), warn: (stats?.pending ?? 0) > 0, icon: FigIcons.pending, tone: 'amber', sub: locale === 'ar' ? 'بانتظار اعتمادك' : 'Awaiting your approval' },
            { label: m.kpi.approved, value: stats?.approved ?? '—', ...figLink('APPROVED'), icon: FigIcons.done, tone: 'green', sub: `${share(stats?.approved ?? 0)}% ${ofTotal}` },
            { label: m.kpi.rejected, value: stats?.rejected ?? '—', ...figLink('REJECTED'), icon: FigIcons.rejected, tone: 'red', sub: `${share(stats?.rejected ?? 0)}% ${ofTotal}` },
            { label: m.kpi.cancelledExpired, value: stats ? (stats.expired ?? 0) + (stats.cancelled ?? 0) : '—', ...figLink(CLOSED), icon: FigIcons.alert, tone: 'gray', sub: `${share((stats?.expired ?? 0) + (stats?.cancelled ?? 0))}% ${ofTotal}` },
          ]}
        />
      </section>

      {(stats?.overdue ?? 0) > 0 && sp.status !== 'OVERDUE' && (
        <AlertStrip
          testId="overdue-reservations-banner"
          action={
            <Link href={pageUrl({ status: 'OVERDUE', page: undefined })} className="shrink-0 text-[13px] font-semibold text-[#8A6823] hover:underline">
              {m.overdueLink}
            </Link>
          }
        >
          {m.overdueBanner(stats!.overdue!)}
        </AlertStrip>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <ListFilterBar
        action="/dashboard/reservations"
        submitLabel={uiT(locale).common.filterBtn}
        advancedHref={toggleFiltersUrl}
        advancedLabel={showFilters ? m.filter.advancedHide : m.filter.advancedShow}
        clearHref={sp.q || sp.status || sp.projectId || hasAdvancedFilters ? '/dashboard/reservations' : undefined}
        clearLabel={uiT(locale).common.clearBtn}
        advanced={
          showFilters ? (
            <>
              <ListFilterField label={m.filter.agentLabel}>
                <Select name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">{m.filter.allAgents}</option>
                  {salesOptions.map((s) => (
                    <option key={s.id} value={s.id}>{salesActorLabel(s)}</option>
                  ))}
                </Select>
              </ListFilterField>
              <ListFilterField label={m.filter.dateFrom}>
                <Input name="dateFrom" type="date" inputSize="sm" defaultValue={sp.dateFrom ?? ''} />
              </ListFilterField>
              <ListFilterField label={m.filter.dateTo}>
                <Input name="dateTo" type="date" inputSize="sm" defaultValue={sp.dateTo ?? ''} />
              </ListFilterField>
            </>
          ) : undefined
        }
      >
        {/* Preserve advanced filter values when the panel is collapsed */}
        {!showFilters && sp.salesId  && <input type="hidden" name="salesId"  value={sp.salesId} />}
        {!showFilters && sp.dateFrom && <input type="hidden" name="dateFrom" value={sp.dateFrom} />}
        {!showFilters && sp.dateTo   && <input type="hidden" name="dateTo"   value={sp.dateTo} />}

        <ListFilterField search label={m.filter.searchLabel} htmlFor="res-q">
          <Input id="res-q" name="q" inputSize="sm" defaultValue={sp.q ?? ''} placeholder={m.filter.searchPlaceholder} />
        </ListFilterField>
        <ListFilterField label={m.filter.statusLabel} htmlFor="res-status">
          <Select id="res-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
            <option value="">{m.filter.allStatuses}</option>
            <option value="PENDING">{m.filter.pending}</option>
            <option value="APPROVED">{m.filter.approved}</option>
            <option value="REJECTED">{m.filter.rejected}</option>
            <option value="CANCELLED">{m.filter.cancelled}</option>
            <option value="EXPIRED">{m.filter.expired}</option>
            <option value={CLOSED}>{m.kpi.cancelledExpired}</option>
            <option value="OVERDUE">{m.filter.overdue}</option>
          </Select>
        </ListFilterField>
        <ListFilterField label={uiT(locale).pages.units.filter.projectLabel} htmlFor="res-projectId">
          <Select id="res-projectId" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
            <option value="">{uiT(locale).common.allProjects}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </ListFilterField>
      </ListFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {reservationsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{reservationsRes.error}</p>
        </div>
      )}

      {/* ── Rows ─────────────────────────────────────────────────────────────── */}
      <ListTableCard
        title={locale === 'ar' ? 'قائمة الحجوزات' : 'Reservations list'}
        sub={locale === 'ar' ? 'مرتبة من الأحدث' : 'Newest first'}
        footer={
          paginationMeta ? (
            <ListPager page={paginationMeta.page} pageSize={paginationMeta.pageSize} total={paginationMeta.total} basePath="/dashboard/reservations" params={sp} locale={locale} />
          ) : undefined
        }
        trailing={
          <span className="tabular-nums">
            {(paginationMeta?.total ?? reservations.length).toLocaleString(intlLocale(locale))} {m.countSuffix}
          </span>
        }
      >
        {reservations.length === 0 ? (
          <PremiumEmptyState icon={<BookmarkCheck />} title={m.empty} />
        ) : (
          <DataTable testId="reservation-rows" widths={[14, 18, 23, 14, 10, 13, 8]}>
            <thead>
              <tr>
                <Th>{locale === 'ar' ? 'رقم الحجز' : 'Reservation'}</Th>
                <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                <Th>{locale === 'ar' ? 'المندوب' : 'Agent'}</Th>
                <Th>{locale === 'ar' ? `مبلغ الحجز (${symbol})` : `Booking amount (${symbol})`}</Th>
                <Th>{locale === 'ar' ? 'الحالة' : 'Status'}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const name = r.client?.fullName ?? r.lead?.fullName ?? '—';
                const project = r.unit?.building?.phase?.project;
                const amount = Number(r.bookingAmount);
                const href = `/dashboard/reservations/${r.id}`;
                return (
                  <Tr key={r.id} testId="reservation-row" waiting={r.status === 'PENDING'}>
                    <Td>
                      <Link href={href as never} data-testid="list-code" className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
                        {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                      </Link>
                    </Td>
                    <Td>
                      <PersonCell name={name} phone={r.client?.phone ?? r.lead?.phone} href={href} />
                    </Td>
                    <Td>
                      <UnitCell
                        cover={project ? covers.get(project.id) : undefined}
                        project={project ? <EntityLink kind="project" id={project.id} mono={false}>{tx(project.name)}</EntityLink> : undefined}
                        unit={r.unit ? <EntityLink kind="unit" id={r.unit.id}>{r.unit.code}</EntityLink> : undefined}
                        unitWord={`${m.unitWord}:`}
                      />
                    </Td>
                    <Td>
                      <AgentCell name={r.sales?.fullName} empty={m.noAgent} />
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[14px] font-bold tabular-nums text-slate-900">
                          {Number.isFinite(amount) ? amount.toLocaleString(intlLocale(locale)) : '—'}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <ReservationStatusBadge status={r.status} locale={locale} dot />
                      {/* When it lapses — under the status, not a column of its own. */}
                      <span className="mt-1 block text-[11.5px] tabular-nums text-slate-500">
                        {locale === 'ar' ? 'ينتهي' : 'Expires'} {formatDate(r.expiresAt, locale, DEFAULT_TIME_ZONE)}
                      </span>
                    </Td>
                    <Td>
                      <ReservationActions
                        reservation={r}
                        canDecide={isAdmin || (isManager && r.salesId !== session?.id)}
                        locale={locale}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </ListTableCard>

    </ListPage>
  );
}
