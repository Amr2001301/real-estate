import Link from 'next/link';
import { Plus, BookmarkCheck, Eye, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalReservation } from '@/lib/types';
import { tx, formatDate, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Amount, FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { DataTable, DateText, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
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
  const covers = new Map(projects.map((p) => [p.project.id, p.project.media?.[0]?.url]));
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

      <section>
        <FigureBar
          variant="cards"
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: paged?.meta.total ?? 0, href: '/portal/reservations', icon: FigIcons.total },
            { label: t.metrics.pending, value: pendingCount, href: '/portal/reservations?status=PENDING', warn: pendingCount > 0, icon: FigIcons.pending },
            { label: t.metrics.approved, value: approvedCount, href: '/portal/reservations?status=APPROVED', icon: FigIcons.done, tone: 'green' },
            { label: t.metrics.converted, value: convertedCount, href: '/portal/reservations?status=CONVERTED', icon: FigIcons.sign, tone: 'blue' },
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
        band
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
          <DataTable testId="portal-reservation-rows">
            <thead>
              <tr>
                <Th>{locale === 'ar' ? 'رقم الحجز' : 'Reservation'}</Th>
                <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                <Th>{m.common.lockedCommission}</Th>
                <Th>{locale === 'ar' ? 'الحالة' : 'Status'}</Th>
                <Th>{locale === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const clientName  = r.lead?.fullName ?? r.client?.fullName ?? '—';
                const clientPhone = r.lead?.phone ?? r.client?.phone ?? undefined;
                const href = `/portal/reservations/${r.id}`;
                const project = r.unit?.building?.phase?.project;
                const commissionParts = r.commissionLockedAmount != null
                  ? compactParts(Number(r.commissionLockedAmount), symbol, locale)
                  : null;
                return (
                  <Tr key={r.id} testId="portal-reservation-row">
                    <Td>
                      <Link href={href as never} className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
                        {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                      </Link>
                    </Td>
                    <Td>
                      <PersonCell name={clientName} phone={clientPhone} href={href} />
                    </Td>
                    <Td>
                      <UnitCell
                        cover={project ? covers.get(project.id) : undefined}
                        project={project ? tx(project.name, locale) : undefined}
                        unit={r.unit?.code}
                        unitWord={locale === 'en' ? 'Unit:' : 'وحدة:'}
                      />
                    </Td>
                    <Td>
                      {r.commissionLockedPct != null ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex min-w-[56px] justify-center rounded-full bg-[#C8A24B]/15 px-2 py-1 text-[12px] font-semibold tabular-nums text-[#8A6823] dark:text-[#E2C792]" dir="ltr">
                            {Number(r.commissionLockedPct).toFixed(2)}%
                          </span>
                          {commissionParts && (
                            <span className="text-[13px] font-semibold tabular-nums text-slate-800">
                              <Amount parts={commissionParts} />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <ReservationStatusBadge status={r.status} locale={locale} />
                    </Td>
                    <Td>
                      <DateText><bdi>{formatDate(r.createdAt, locale)}</bdi></DateText>
                    </Td>
                    <Td>
                      <Link
                        href={href as never}
                        aria-label={m.common.view}
                        title={m.common.view}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
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
