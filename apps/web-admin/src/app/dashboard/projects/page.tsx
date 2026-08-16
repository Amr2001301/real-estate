import Link from 'next/link';
import {
  Plus,
  Building2,
  CheckCircle2,
  MapPinned,
  Star,
  Eye,
  Pencil,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Project } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { ProjectStatusBadge } from '@/components/badges';
import { ProjectThumbnail } from '@/components/projects/project-thumbnail';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumEmptyState,
} from '@/components/premium';

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
  const [pagedRes, snapshotRes] = await Promise.all([
    safe(api.get<Paged<Project>>(`/projects?${qs.toString()}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

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
  const isAdmin = session?.role === 'ADMIN';

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
          isAdmin ? (
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

      {/* ── Projects table ── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
              <tr>
                <th className="text-start py-3.5 ps-5 pe-4">{m.cols.project}</th>
                <th className="text-start py-3.5 px-4">{m.cols.location}</th>
                <th className="text-start py-3.5 px-4">{m.cols.status}</th>
                <th className="text-start py-3.5 px-4">{m.cols.phases}</th>
                <th className="text-start py-3.5 px-4">{m.cols.type}</th>
                <th className="text-start py-3.5 px-4">{m.cols.updated}</th>
                <th className="text-start py-3.5 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <PremiumEmptyState
                      icon={<Building2 />}
                      title={m.empty.title}
                      description={m.empty.description}
                      action={
                        isAdmin ? (
                          <Link href={'/dashboard/projects/new' as never}>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Plus className="h-4 w-4" />}
                            >
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
                const phaseCount = p.phases?.length ?? 0;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-canvas/40 transition-colors duration-100"
                  >
                    <td className="py-3.5 ps-5 pe-4">
                      <div className="flex items-center gap-3">
                        <ProjectThumbnail src={cover} alt={tx(p.name)} size="md" />
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/projects/${p.id}` as never}
                            className="font-semibold text-navy hover:text-brand-700 transition-colors"
                          >
                            {tx(p.name)}
                          </Link>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            PJ-{p.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinned className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {p.city || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <ProjectStatusBadge status={p.status} locale={locale} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 tabular-nums">
                      {phaseCount > 0 ? `${phaseCount} ${m.phaseSuffix}` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.featured ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                          <Star className="h-3 w-3 fill-current" /> {m.featured}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500">
                          {m.standard}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {formatDate(p.updatedAt)}
                    </td>
                    <td className="py-3.5 ps-4 pe-5">
                      <Link href={`/dashboard/projects/${p.id}` as never}>
                        <IconButton label={m.viewBtn} variant="outline" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
      </div>
    </div>
  );
}
