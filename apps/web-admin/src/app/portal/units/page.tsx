import Link from 'next/link';
import { Home, ShieldCheck, BookmarkPlus, AlertCircle, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalUnit } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { FigureBar } from '@/components/cockpit/cockpit';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { UnitStatusBadge } from '@/components/badges';
import { UnitsFilterBar } from '@/components/broker/units-filter-bar';
import {
  PremiumPageHero,
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
  const word = (ar: string, en: string) => (locale === 'en' ? en : ar);
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

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: paged?.meta.total ?? 0 },
            { label: t.metrics.available, value: availableCount, href: '/portal/units?status=AVAILABLE' },
            { label: t.metrics.reserved, value: reservedCount, href: '/portal/units?status=RESERVED' },
            { label: t.metrics.sold, value: soldCount, href: '/portal/units?status=SOLD' },
          ]}
        />
      </section>

      <UnitsFilterBar projects={projects} typeOptions={typeOptions} sp={sp} locale={locale} />

      <PremiumSectionCard
        icon={<Home />}
        title={t.sectionTitle}
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState icon={<Home />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-unit-rows">
            {rows.map((u) => (
              <li
                key={u.id}
                data-testid="portal-unit-row"
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[44px_minmax(150px,1.1fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(130px,1fr)_minmax(150px,1fr)_auto]"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                  <Home className="h-[18px] w-[18px]" />
                </span>

                {/* Unit code + type */}
                <div className="min-w-0">
                  {/* Label above the code: long codes (DF-LB-Z01-302) never clip. */}
                  <p className="text-[14.5px] font-bold text-slate-900">
                    <span className="block text-[11.5px] font-semibold text-slate-400">{word('وحدة', 'Unit')}</span>
                    <span className="whitespace-nowrap font-mono" dir="ltr">{u.code}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    <span className="font-mono uppercase tracking-wide" dir="ltr">{u.type}</span>
                    <span className="lg:hidden"> · {formatCurrency(u.price, currency, locale)}</span>
                  </p>
                </div>

                {/* Project, city, building */}
                <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{tx(u.building.phase.project.name, locale)}</p>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">
                      {u.building.phase.project.city}
                      {' · '}
                      <span className="me-1 text-slate-400">{word('مبنى', 'Building')}</span>
                      <bdi>{u.building.name}</bdi>
                    </p>
                  </div>
                </div>

                {/* Specs */}
                <div className="hidden text-[12.5px] lg:block">
                  <p className="font-semibold tabular-nums text-slate-800">{t.areaFn(u.area)}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">{t.roomsFn(u.bedrooms, u.bathrooms, u.floor)}</p>
                </div>

                {/* Price */}
                <div className="hidden text-start lg:block">
                  <p className="text-[11px] text-slate-500">{t.cols.price}</p>
                  <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(u.price, currency, locale)}
                  </p>
                </div>

                {/* Status + access */}
                <div className="hidden flex-col items-start gap-1 lg:flex">
                  <UnitStatusBadge status={u.status} locale={locale} />
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500">
                    <ShieldCheck className="h-3 w-3 shrink-0 text-brand-400" />
                    {t.accessSource[u.accessSource]}
                  </span>
                </div>

                {/* Action */}
                <div className="flex items-center justify-end gap-2">
                  <span className="lg:hidden"><UnitStatusBadge status={u.status} locale={locale} /></span>
                  {u.status === 'AVAILABLE' && (
                    <Link
                      href="/portal/reservations/new"
                      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#C9A24E]/50 bg-[#C9A24E]/10 px-4 text-[13px] font-bold text-brand-700 transition-colors hover:bg-[#C9A24E]/20"
                    >
                      <BookmarkPlus className="h-4 w-4" />
                      {t.reserve}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
