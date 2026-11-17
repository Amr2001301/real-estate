import Link from 'next/link';
import { BookmarkCheck, Eye, Plus, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions, brokerOptions, staffOptions } from '@/lib/options';
import type { AdminBrokerReservation, Paged, Project } from '@/lib/types';
import { tx, formatDate, formatCurrency, intlLocale } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Avatar, FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { AgentCell, DataTable, DateText, ListTableCard, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { ReservationStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumEmptyState,
  PremiumFilterAdvancedToggle,
  PremiumFilterAdvancedPanel,
} from '@/components/premium';
import { EntityLink } from '@/components/entity-link';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  projectId?: string;
  salesId?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerReservationsPage;
  const currency = await getReportsCurrency();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const key of ['brokerId', 'status', 'projectId', 'salesId'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [resRes, brokersRes, projectsRes, salesRes, coverRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerReservation>>(`/broker-reservations?${qs.toString()}`)),
    safe(brokerOptions()),
    safe(projectOptions()),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);
  const covers = new Map((coverRes.data?.data ?? []).map((p) => [p.id, p.media?.[0]?.url]));

  const paged = resRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    converted: rows.filter((r) => r.status === 'CONVERTED').length,
    failed: rows.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  };

  // Page-scoped commission total (safely derived from existing row data)
  const totalCommission = rows.reduce(
    (acc, r) => acc + Number(r.commissionLockedAmount ?? 0),
    0,
  );

  const totalReservations = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.status || sp.projectId || sp.salesId);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      status: sp.status,
      projectId: sp.projectId,
      salesId: sp.salesId,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-reservations${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.heroTitle}
        description={m.heroDescription}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: m.breadcrumbSelf },
        ]}
        actions={
          <Link href={'/dashboard/broker-reservations/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.newReservationBtn}
            </Button>
          </Link>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <section>
        <FigureBar
          variant="cards"
          cols={4}
          figures={[
            { label: m.kpiTotal, value: totalReservations, icon: FigIcons.total, pct: 100 },
            { label: m.kpiPending, value: counts.pending, sub: m.kpiThisPage, warn: counts.pending > 0, icon: FigIcons.pending, pct: totalReservations ? (counts.pending / totalReservations) * 100 : 0 },
            { label: m.kpiApproved, value: counts.approved, sub: m.kpiThisPage, icon: FigIcons.done, tone: 'green', pct: totalReservations ? (counts.approved / totalReservations) * 100 : 0 },
            { label: m.kpiConverted, value: counts.converted, sub: m.kpiThisPage, icon: FigIcons.sign, tone: 'blue', pct: totalReservations ? (counts.converted / totalReservations) * 100 : 0 },
          ]}
        />
      </section>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {resRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorLoad}{resRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-reservations">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.status    && <input type="hidden" name="status"    value={sp.status} />}
        {!showFilters && sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}
        {!showFilters && sp.salesId   && <input type="hidden" name="salesId"   value={sp.salesId} />}

        {/* ── Row 1: broker filter + actions (always visible) ───────────────── */}
        <PremiumFilterField label={m.filterBrokerLabel} htmlFor="bres-broker">
          <Select id="bres-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
            <option value="">{m.filterAllBrokers}</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </Select>
        </PremiumFilterField>

        {/* Action buttons — BEFORE the basis-full panel so ms-auto keeps them in row 1 */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {hasAnyFilter && (
            <Link href={'/dashboard/broker-reservations' as never}>
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
          <PremiumFilterAdvancedToggle href={toggleFiltersUrl} open={showFilters} active={hasAdvancedFilters} label={showFilters ? m.filterHideFilters : m.filterAdvanced} />
        </div>

        {/* ── Row 2: advanced panel (basis-full forces a new flex row) ─────── */}
        {showFilters && (
          <PremiumFilterAdvancedPanel>
              <PremiumFilterField label={m.filterStatus}>
<Select id="bres-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
                  <option value="">{m.filterAllStatuses}</option>
                  <option value="PENDING">{m.filterStatusPending}</option>
                  <option value="APPROVED">{m.filterStatusApproved}</option>
                  <option value="REJECTED">{m.filterStatusRejected}</option>
                  <option value="CANCELLED">{m.filterStatusCancelled}</option>
                  <option value="EXPIRED">{m.filterStatusExpired}</option>
                  <option value="CONVERTED">{m.filterStatusConverted}</option>
                </Select>
</PremiumFilterField>
              <PremiumFilterField label={m.filterProject}>
<Select id="bres-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">{m.filterAllProjects}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
</PremiumFilterField>
              <PremiumFilterField label={m.filterInternalRep}>
<Select id="bres-sales" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">{m.filterAllReps}</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </Select>
</PremiumFilterField>
            </PremiumFilterAdvancedPanel>
        )}
      </PremiumFilterBar>

      {/* ── Reservations table ───────────────────────────────────────────────── */}
      <ListTableCard
        title={m.tableTitle}
        sub={m.tableDescription}
        trailing={
          totalCommission > 0 ? (
            <span className="tabular-nums whitespace-nowrap" dir="ltr">
              {m.tableTrailingCommission}{formatCurrency(totalCommission, currency, locale)}
            </span>
          ) : (
            <span className="tabular-nums">
              {totalReservations.toLocaleString(intlLocale(locale))} {m.tableTrailingCount}
            </span>
          )
        }
      >
        {rows.length === 0 && !resRes.error ? (
          <PremiumEmptyState
            icon={<BookmarkCheck />}
            title={m.emptyTitle}
            description={m.emptyDescription}
            action={
              <Link href={'/dashboard/broker-reservations/new' as never}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  {m.emptyNewBtn}
                </Button>
              </Link>
            }
            className="py-12"
          />
        ) : (
          <DataTable testId="broker-reservation-rows">
            <thead>
              <tr>
                <Th>{m.colReservationNumber}</Th>
                <Th>{m.colBroker}</Th>
                <Th>{m.colClient}</Th>
                <Th>{m.colUnit}</Th>
                <Th>{m.colStatus}</Th>
                <Th>{m.colInternalRep}</Th>
                <Th>{m.colLockedCommission}</Th>
                <Th>{m.colCreatedAt}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const project = r.unit?.building?.phase?.project;
                return (
                  <Tr key={r.id}>
                    <Td>
                      {r.reservationNumber ? (
                        <EntityLink kind="reservation" id={r.id} className="font-mono text-[12.5px] font-semibold text-brand-700">
                          {r.reservationNumber}
                        </EntityLink>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {r.broker ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.broker.companyName} className="h-8 w-8 text-[11px]" />
                          <div className="min-w-0">
                            <Link href={`/dashboard/brokers/${r.broker.id}` as never} className="block max-w-[140px] truncate text-[13.5px] font-semibold text-slate-900 hover:text-brand-700">
                              {r.broker.companyName}
                            </Link>
                            {r.brokerAgent && <span className="block max-w-[140px] truncate text-[11.5px] text-slate-500">{r.brokerAgent.fullName}</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <PersonCell
                        name={r.lead?.fullName ?? r.client?.fullName ?? '—'}
                        phone={r.lead?.phone ?? r.client?.phone}
                        href={r.lead ? `/dashboard/leads/${r.lead.id}` : r.client ? `/dashboard/clients/${r.client.id}` : undefined}
                      />
                    </Td>
                    <Td>
                      <UnitCell
                        cover={project ? covers.get(project.id) : undefined}
                        project={project ? <EntityLink kind="project" id={project.id} mono={false}>{tx(project.name)}</EntityLink> : undefined}
                        unit={r.unit?.code ? <EntityLink kind="unit" id={r.unit.id}>{r.unit.code}</EntityLink> : undefined}
                        unitWord={m.colUnit + ':'}
                      />
                    </Td>
                    <Td>
                      <ReservationStatusBadge status={r.status} />
                    </Td>
                    <Td>
                      <AgentCell name={r.sales?.fullName} empty={m.unassigned} />
                    </Td>
                    {/* Locked commission */}
                    <Td>
                      {r.commissionLockedPct != null || r.commissionLockedAmount != null ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              r.commissionLockedPct != null
                                ? 'inline-flex min-w-[56px] justify-center rounded-full bg-[#C8A24B]/15 px-2 py-1 text-[12px] font-semibold tabular-nums text-[#8A6823] dark:text-[#E2C792]'
                                : 'inline-flex min-w-[56px] justify-center rounded-full bg-slate-500/12 px-2 py-1 text-[12px] font-semibold text-slate-600'
                            }
                            dir="ltr"
                          >
                            {r.commissionLockedPct != null ? `${Number(r.commissionLockedPct).toFixed(2)}%` : m.commissionFixed}
                          </span>
                          {r.commissionLockedAmount != null && (
                            <span className="text-[13px] font-semibold tabular-nums text-slate-800">
                              {formatCurrency(r.commissionLockedAmount, currency, locale)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">{m.commissionUnset}</span>
                      )}
                    </Td>
                    <Td>
                      <DateText>{formatDate(r.createdAt, locale)}</DateText>
                    </Td>
                    <Td>
                      <Link href={`/dashboard/reservations/${r.id}` as never}>
                        <IconButton label={m.actionView} variant="ghost" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </ListTableCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {paged && paged.meta.total > PAGE_SIZE && (
        <Pagination
          page={paged.meta.page}
          pageSize={paged.meta.pageSize}
          total={paged.meta.total}
          basePath="/dashboard/broker-reservations"
          params={{
            brokerId: sp.brokerId,
            status: sp.status,
            projectId: sp.projectId,
            salesId: sp.salesId,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
