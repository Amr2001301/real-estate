import Link from 'next/link';
import {
  Plus,
  Building2,
  CheckCircle2,
  Star,
  Pencil,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import { getSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import type { InventoryMatrixResult, Paged, Project } from '@/lib/types';
import { tx, formatDate, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { ProjectThumbnail } from '@/components/projects/project-thumbnail';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumEmptyState,

} from '@/components/premium';
import {
  PremiumTableCard,
  PREMIUM_ROW,
  RowTitle,
  RowIconTile,
  RowOpenButton,
  NumCell,
  UnitsBar,
  StatusPill,
} from '@/components/premium/data-table';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Filters {
  page?: string;
  status?: string;
  city?: string;
  q?: string;
}

const PAGE_SIZE = 12;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const [sp, locale, session] = await Promise.all([
    searchParams,
    getLocale(),
    getSession(),
  ]);
  const m = uiT(locale).pages.projects;

  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.status) qs.set('status', sp.status);
  if (sp.city) qs.set('city', sp.city);
  if (sp.q) qs.set('q', sp.q);

  // For the city dropdown + KPI strip we also pull a wider snapshot.
  // Units per project come from the inventory matrix; contract value (admin
  // only) from the admin summary — no extra API.
  const isAdminRole = session?.role === 'ADMIN';
  const [pagedRes, snapshotRes, matrixRes, summaryRes, currency] = await Promise.all([
    safe(api.get<Paged<Project>>(`/projects?${qs.toString()}`)),
    safe(projectOptions()),
    safe(api.get<InventoryMatrixResult>('/units/inventory-matrix')),
    isAdminRole
      ? safe(api.get<{ topProjects?: Array<{ id: string; contractValue: number }> }>('/reports/admin-summary'))
      : Promise.resolve({ data: null }),
    getReportsCurrency(),
  ]);
  const symbol = currencySymbol(currency, locale);
  const unitsByProject = new Map(
    (matrixRes.data?.projects ?? []).map((p) => [p.id, { sold: p.sold, reserved: p.reserved, available: p.available }]),
  );
  const valueByProject = new Map((summaryRes.data?.topProjects ?? []).map((p) => [p.id, p.contractValue]));

  const paged = pagedRes.data;
  const snapshot = snapshotRes.data;

  // Client-side filter fallback: if API ignores ?status / ?city / ?q, narrow down here.
  let rows = paged?.data ?? [];
  if (sp.status) rows = rows.filter((p) => p.status === sp.status);
  if (sp.city) rows = rows.filter((p) => p.city === sp.city);
  if (sp.q) {
    const needle = sp.q.toLowerCase();
    rows = rows.filter((p) => tx(p.name).toLowerCase().includes(needle));
  }

  const allProjects = snapshot?.data ?? [];
  const cities = Array.from(new Set(allProjects.map((p) => p.city).filter(Boolean)));

  // Project mutations are ADMIN-only (projects:create/update/publish/delete).
  // SALES browses read-only, so creation CTAs are hidden for them.
  const isAdmin = isAdminRole;
  // Adding a project opens to whoever holds projects:create (PRM).
  const canCreate = isAdmin || (await can('projects:create'));
  // Drop "last update" when no row has one (U5: no always-empty columns).
  const showUpdated = rows.some((p) => !!p.updatedAt);
  const STATUS_LABEL: Record<string, string> = {
    PUBLISHED: m.filter.published,
    DRAFT: m.filter.draft,
    ARCHIVED: m.filter.archived,
  };

  // KPI computation from real data (no fakes).
  const total = paged?.meta.total ?? allProjects.length;
  const published = allProjects.filter((p) => p.status === 'PUBLISHED').length;
  const drafts = allProjects.filter((p) => p.status === 'DRAFT').length;
  const featuredCount = allProjects.filter((p) => p.featured).length;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Premium hero ── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          canCreate ? (
            <Link href={'/dashboard/projects/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addBtn}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── KPI strip ── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: m.kpi.total,     value: total,         icon: <Building2 />,   tone: 'brand',   primary: true },
          { label: m.kpi.published, value: published,     icon: <CheckCircle2 />, tone: 'success' },
          { label: m.kpi.drafts,    value: drafts,        icon: <Pencil />,       tone: 'warning' },
          { label: m.kpi.featured,  value: featuredCount, icon: <Star />,         tone: 'purple'  },
        ]}
      />

      {/* ── Error banner ── */}
      {pagedRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.errorPrefix} {pagedRes.error}
        </div>
      )}

      {/* ── Filter bar ── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/projects"
        summary={
          <>
            <span className="text-slate-700">
              <span className="num text-[20px] font-semibold text-slate-900">{total}</span>{' '}
              {m.resultCount(total).replace(/^\d+\s*/, '')}
            </span>
            {(sp.status || sp.city || sp.q) && (
              <Link href={'/dashboard/projects' as never} className="font-bold text-brand-700 underline underline-offset-4">
                {m.clearAll}
              </Link>
            )}
          </>
        }
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{m.filter.searchLabel}</Button>
            {(sp.status || sp.city || sp.q) && (
              <Link href={'/dashboard/projects' as never}>
                <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={m.filter.searchLabel} htmlFor="q">
          <Input
            id="q"
            name="q"
            type="search"
            placeholder={m.filter.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="flex-1 min-w-40 h-8 text-sm"
          />
        </PremiumFilterField>

        <PremiumFilterField label={m.filter.statusLabel} htmlFor="status">
          <Select id="status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36 shrink-0">
            <option value="">{m.filter.allStatuses}</option>
            <option value="DRAFT">{m.filter.draft}</option>
            <option value="PUBLISHED">{m.filter.published}</option>
            <option value="ARCHIVED">{m.filter.archived}</option>
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label={m.filter.cityLabel} htmlFor="city">
          <Select id="city" name="city" inputSize="sm" defaultValue={sp.city ?? ''} className="w-36 shrink-0">
            <option value="">{m.filter.allCities}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* ── Projects table (U5) ── */}
      <PremiumTableCard>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-start py-4 ps-6 pe-4">{m.cols.project}</th>
              <th className="text-start py-4 px-4">{m.cols.location}</th>
              <th className="text-start py-4 px-4">{m.cols.status}</th>
              <th className="text-start py-4 px-4">{m.cols.units}</th>
              {isAdmin && <th className="text-start py-4 px-4">{m.cols.contractValue}</th>}
              {showUpdated && <th className="text-start py-4 px-4">{m.cols.updated}</th>}
              <th className="py-4 ps-4 pe-6 w-px"><span className="sr-only">{m.viewBtn}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-0">
                  <PremiumEmptyState
                    icon={<Building2 />}
                    title={m.empty.title}
                    description={m.empty.description}
                    action={
                      canCreate ? (
                        <Link href={'/dashboard/projects/new' as never}>
                          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                            {m.empty.addBtn}
                          </Button>
                        </Link>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const cover = p.media?.[0]?.url;
              const counts = unitsByProject.get(p.id) ?? { sold: 0, reserved: 0, available: 0 };
              const value = valueByProject.get(p.id) ?? 0;
              const [num, unit] = compactParts(value, symbol, locale);
              return (
                <tr key={p.id} className={PREMIUM_ROW}>
                  <td className="py-5 ps-6 pe-4">
                    <RowTitle
                      title={tx(p.name)}
                      href={`/dashboard/projects/${p.id}`}
                      code={p.code || undefined}
                      codeLabel={locale === 'en' ? 'Code' : 'كود'}
                      icon={
                        cover ? (
                          <ProjectThumbnail src={cover} alt={tx(p.name)} size="md" />
                        ) : (
                          <RowIconTile><Building2 /></RowIconTile>
                        )
                      }
                    />
                  </td>
                  <td className="py-5 px-4 text-[15px] text-slate-600">{p.city || '—'}</td>
                  <td className="py-5 px-4">
                    <StatusPill
                      label={STATUS_LABEL[p.status] ?? p.status}
                      tone={p.status === 'PUBLISHED' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="py-5 px-4">
                    <UnitsBar counts={counts} labels={m.unitLabels} emptyLabel={m.noUnits} />
                  </td>
                  {isAdmin && (
                    <td className="py-5 px-4">
                      <NumCell value={num} unit={unit} />
                    </td>
                  )}
                  {showUpdated && (
                    <td className="py-5 px-4 text-[13px] text-slate-500">{formatDate(p.updatedAt, locale)}</td>
                  )}
                  <td className="py-5 ps-4 pe-6">
                    <RowOpenButton href={`/dashboard/projects/${p.id}`} label={m.viewBtn} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paged && paged.meta.total > PAGE_SIZE && (
          <div className="border-t border-hairline bg-canvas/20">
            <Pagination
              page={paged.meta.page}
              pageSize={paged.meta.pageSize}
              total={paged.meta.total}
              basePath="/dashboard/projects"
              params={{ status: sp.status, city: sp.city, q: sp.q }}
              locale={locale}
            />
          </div>
        )}
      </PremiumTableCard>
    </div>
  );
}
