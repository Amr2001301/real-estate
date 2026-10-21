import Link from 'next/link';
import { Plus, BookmarkCheck, Eye, Phone, AlertCircle, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalReservation } from '@/lib/types';
import { tx, formatDate, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Avatar, Amount, FigureBar } from '@/components/cockpit/cockpit';
import { getLocale } from '@/lib/locale';
import { portalReservationsContractsT } from '@/messages/portal/reservations-contracts';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ReservationsFilterBar } from '@/components/broker/reservations-filter-bar';
import { ReservationStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  q?: string;
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function PortalReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalReservationsContractsT(locale);
  const t = m.reservations.list;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.q)         qs.set('q', sp.q);
  if (sp.status)    qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.from)      qs.set('from', sp.from);
  if (sp.to)        qs.set('to', sp.to);

  const [resRes, projectsRes, rPending, rApproved, rConverted] = await Promise.all([
    safe(api.get<Paged<PortalReservation>>(`/portal/reservations?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=PENDING')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=CONVERTED')),
  ]);

  const paged          = resRes.data;
  const rows           = paged?.data ?? [];
  const projects       = projectsRes.data ?? [];
  const pendingCount   = rPending.data?.meta.total   ?? 0;
  const approvedCount  = rApproved.data?.meta.total  ?? 0;
  const convertedCount = rConverted.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: m.common.reservations },
        ]}
        actions={
          <Link href="/portal/reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {t.newReservation}
            </Button>
          </Link>
        }
      />

      {resRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadErrorFn(resRes.error)}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: paged?.meta.total ?? 0, href: '/portal/reservations' },
            { label: t.metrics.pending, value: pendingCount, href: '/portal/reservations?status=PENDING', warn: pendingCount > 0 },
            { label: t.metrics.approved, value: approvedCount, href: '/portal/reservations?status=APPROVED' },
            { label: t.metrics.converted, value: convertedCount, href: '/portal/reservations?status=CONVERTED' },
          ]}
        />
      </section>

      <ReservationsFilterBar
        projects={projects}
        locale={locale}
        sp={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }}
      />

      <PremiumSectionCard
        icon={<BookmarkCheck />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>{t.countUnit}</span>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<BookmarkCheck />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Link href="/portal/reservations/new">
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  {t.newReservation}
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-reservation-rows">
            {rows.map((r) => {
              const clientName  = r.lead?.fullName ?? r.client?.fullName ?? '—';
              const clientPhone = r.lead?.phone ?? r.client?.phone ?? undefined;
              const href = `/portal/reservations/${r.id}`;
              const commissionParts = r.commissionLockedAmount != null
                ? compactParts(Number(r.commissionLockedAmount), symbol, locale)
                : null;
              return (
                <li
                  key={r.id}
                  data-testid="portal-reservation-row"
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.1fr)_150px_150px_110px_36px]"
                >
                  <Avatar name={clientName} />

                  {/* Client + reservation code */}
                  <div className="min-w-0">
                    <Link href={href as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {clientName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                      <Link href={href as never} className="whitespace-nowrap hover:text-brand-700">
                        <span className="me-1 text-slate-400">{locale === 'en' ? 'Reservation' : 'حجز'}</span>
                        <span className="font-mono font-semibold text-brand-700" dir="ltr">
                          {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </Link>
                      {clientPhone && (
                        <a href={`tel:${clientPhone}`} className="inline-flex items-center gap-1 tabular-nums hover:text-brand-700">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{clientPhone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Project + unit */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {r.unit?.building ? tx(r.unit.building.phase.project.name, locale) : '—'}
                      </p>
                      {r.unit && (
                        <p className="mt-0.5 text-slate-500">
                          <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span>
                          <span className="whitespace-nowrap font-mono" dir="ltr">{r.unit.code}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Locked commission */}
                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-400">{m.common.lockedCommission}</p>
                    {r.commissionLockedPct != null ? (
                      <p className="mt-0.5 whitespace-nowrap font-bold tabular-nums text-brand-700">
                        {Number(r.commissionLockedPct).toFixed(2)}%
                        {commissionParts && (
                          <span className="ms-2 text-[12px] font-semibold text-slate-600">
                            <Amount parts={commissionParts} />
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-slate-400">—</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="hidden lg:block">
                    <ReservationStatusBadge status={r.status} locale={locale} />
                  </div>

                  {/* Created */}
                  <span className="hidden whitespace-nowrap text-[12px] tabular-nums text-slate-500 lg:block">
                    <bdi>{formatDate(r.createdAt, locale)}</bdi>
                  </span>

                  <Link
                    href={href as never}
                    aria-label={m.common.view}
                    title={m.common.view}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/reservations"
            locale={locale}
            params={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
