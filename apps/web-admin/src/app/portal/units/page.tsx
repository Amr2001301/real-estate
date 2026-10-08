import Link from 'next/link';
import {
  Home,
  ShieldCheck,
  BookmarkPlus,
  CheckCircle2,
  BookmarkCheck,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalUnit } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { CodeText } from '@/components/ui/code-text';
import { UnitStatusBadge } from '@/components/badges';
import { UnitsFilterBar } from '@/components/broker/units-filter-bar';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  projectId?: string;
  status?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  q?: string;
}

const PAGE_SIZE = 20;

export default async function PortalUnitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalDashboardT(locale);
  const t = m.units;
  const currency = await getReportsCurrency();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['projectId', 'status', 'type', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'q'] as const) {
    const value = sp[key];
    if (value) qs.set(key, value);
  }

  const [unitsRes, projectsRes, rAvailable, rReserved, rSold] = await Promise.all([
    safe(api.get<Paged<PortalUnit>>(`/portal/units?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?page=1&pageSize=1&status=AVAILABLE')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?page=1&pageSize=1&status=RESERVED')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?page=1&pageSize=1&status=SOLD')),
  ]);

  const paged          = unitsRes.data;
  const rows           = paged?.data ?? [];
  const projects       = projectsRes.data ?? [];
  const availableCount = rAvailable.data?.meta.total ?? 0;
  const reservedCount  = rReserved.data?.meta.total  ?? 0;
  const soldCount      = rSold.data?.meta.total      ?? 0;

  const knownTypes = Array.from(new Set(rows.map((u) => u.type))).filter(Boolean);
  const typeOptions = knownTypes.length > 0
    ? knownTypes
    : ['studio', '1BR', '2BR', '3BR', '4BR', 'villa'];

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: t.breadcrumb },
        ]}
      />

      {unitsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadErrorFn(unitsRes.error)}
        </div>
      )}

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: t.metrics.total, value: paged?.meta.total ?? 0, icon: <Home />,          tone: 'brand'   },
          { label: t.metrics.available,    value: availableCount,         icon: <CheckCircle2 />,  tone: 'success' },
          { label: t.metrics.reserved,         value: reservedCount,          icon: <BookmarkCheck />, tone: 'warning' },
          { label: t.metrics.sold,          value: soldCount,              icon: <Tag />,           tone: 'info'    },
        ]}
      />

      <UnitsFilterBar projects={projects} typeOptions={typeOptions} sp={sp} locale={locale} />

      <PremiumSectionCard
        icon={<Home />}
        title={t.sectionTitle}
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>{t.matchingUnits}</span>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<Home />}
            title={t.emptyTitle}
            description={t.emptyDescription}
          />
        ) : (
          <>
            {/* Mobile card list (< sm) */}
            <ul className="sm:hidden divide-y divide-hairline">
              {rows.map((u) => (
                <li key={u.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-bold text-slate-900 text-base shrink-0">
                        <CodeText>{u.code}</CodeText>
                      </p>
                      <p className="shrink-0">
                        <CodeText className="text-xs text-slate-500 uppercase tracking-wide">{u.type}</CodeText>
                      </p>
                      <UnitStatusBadge status={u.status} locale={locale} />
                    </div>
                    {u.status === 'AVAILABLE' && (
                      <Link href="/portal/reservations/new" className="shrink-0">
                        <Button variant="primary" size="sm" leftIcon={<BookmarkPlus className="h-3.5 w-3.5" />}>
                          {t.reserve}
                        </Button>
                      </Link>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-800">
                    {tx(u.building.phase.project.name, locale)}
                  </p>

                  <p className="text-2xs text-slate-400">
                    {u.building.phase.project.city}
                    {' · '}
                    <CodeText>{u.building.name}</CodeText>
                  </p>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-2xs text-slate-500 tabular-nums">
                      {t.areaFn(u.area)} · {t.roomsFn(u.bedrooms, u.bathrooms, u.floor)}
                    </p>
                    <p className="font-bold text-slate-900 tabular-nums text-sm shrink-0">
                      {formatCurrency(u.price, currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table (≥ sm) */}
            <div className="hidden sm:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-start font-semibold py-3 ps-5 pe-4">{t.cols.unit}</th>
                    <th className="text-start font-semibold py-3 px-4">{t.cols.location}</th>
                    <th className="text-start font-semibold py-3 px-4">{t.cols.specs}</th>
                    <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">{t.cols.price}</th>
                    <th className="text-start font-semibold py-3 px-4">{t.cols.status}</th>
                    <th className="py-3 ps-4 pe-5 w-px"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-hairline hover:bg-surface-muted/40 transition-colors align-top"
                    >
                      <td className="py-3 ps-5 pe-4">
                        <p className="font-bold text-slate-900 text-sm">
                          <CodeText>{u.code}</CodeText>
                        </p>
                        <p className="mt-0.5">
                          <CodeText className="text-xs text-slate-500 uppercase tracking-wide">{u.type}</CodeText>
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 text-xs">
                          {tx(u.building.phase.project.name, locale)}
                        </p>
                        <p className="text-2xs text-slate-500 mt-0.5">
                          {u.building.phase.project.city}
                        </p>
                        <p className="mt-0.5">
                          <CodeText className="text-2xs text-slate-400">{u.building.name}</CodeText>
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-xs font-semibold text-slate-700 tabular-nums">
                          {t.areaFn(u.area)}
                        </p>
                        <p className="text-2xs text-slate-500 mt-0.5 whitespace-nowrap">
                          {t.roomsFn(u.bedrooms, u.bathrooms, u.floor)}
                        </p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-bold text-slate-900 tabular-nums text-sm">
                          {formatCurrency(u.price, currency)}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <UnitStatusBadge status={u.status} locale={locale} />
                        <p className="text-2xs text-slate-400 mt-1.5 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-brand-400 shrink-0" />
                          {t.accessSource[u.accessSource]}
                        </p>
                      </td>

                      <td className="py-3 ps-4 pe-5">
                        {u.status === 'AVAILABLE' && (
                          <Link href="/portal/reservations/new">
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<BookmarkPlus className="h-3.5 w-3.5" />}
                            >
                              {t.reserve}
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/units"
            locale={locale}
            params={{
              projectId: sp.projectId,
              status:    sp.status,
              type:      sp.type,
              minPrice:  sp.minPrice,
              maxPrice:  sp.maxPrice,
              bedrooms:  sp.bedrooms,
              bathrooms: sp.bathrooms,
              q:         sp.q,
            }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
