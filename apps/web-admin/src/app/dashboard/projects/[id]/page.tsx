import Link from 'next/link';
import {
  Pencil,
  Send,
  Archive,
  Building2,
  Layers,
  Plus,
  Home,
  MapPin,
  Star,
  Shapes,
  CalendarDays,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Project, Paged, Unit } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge, UnitStatusBadge } from '@/components/badges';
import { PremiumPanel, PremiumEmptyNote } from '@/components/premium';
import { ServiceTileGrid } from '@/components/projects/service-tile-grid';
import { ProjectMap } from '@/components/maps/project-map';
import { ConfirmButton } from '@/components/confirm-button';
import {
  publishProjectAction,
  archiveProjectAction,
  deleteProjectAction,
} from '../actions';
import { ProjectMediaPanel } from './media-panel';
import { BuildingCreateForm, PhaseCreateForm, PhaseDeliveryForm } from './structure-forms';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [currency, locale] = await Promise.all([getReportsCurrency(), getLocale()]);
  const m = uiT(locale).projectDetailPage;
  const pf = uiT(locale).pages.projectsForm;

  const countOf = (status: string) =>
    safe(api.get<Paged<Unit>>(`/units?projectId=${id}&status=${status}&pageSize=1`)).then(
      (r) => r.data?.meta.total ?? 0,
    );
  const [projectRes, unitsRes, available, reserved, sold] = await Promise.all([
    safe(api.get<Project>(`/projects/${id}`)),
    safe(api.get<Paged<Unit>>(`/units?projectId=${id}&pageSize=8`)),
    countOf('AVAILABLE'),
    countOf('RESERVED'),
    countOf('SOLD'),
  ]);

  if (projectRes.error || !projectRes.data) {
    return (
      <div className="rounded-[18px] bg-danger-500/10 p-6 text-sm text-danger-600">
        {m.loadError(projectRes.error ?? m.loadErrorDefault)}
      </div>
    );
  }

  const project = projectRes.data;
  const units = unitsRes.data?.data ?? [];
  const cover = project.media?.find((x) => x.type !== 'VIDEO')?.url;

  // Project mutations are ADMIN-only — SALES views read-only.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  const phaseCount = project.phases?.length ?? 0;
  const buildingCount =
    project.phases?.reduce((s, ph) => s + (ph.buildings?.length ?? 0), 0) ?? 0;
  const unitsCountFromBuildings =
    project.phases?.reduce(
      (s, ph) =>
        s + (ph.buildings?.reduce((bs, b) => bs + (b._count?.units ?? 0), 0) ?? 0),
      0,
    ) ?? 0;
  const totalUnits = unitsRes.data?.meta.total ?? unitsCountFromBuildings;
  // Occupancy over every unit of the project, not the first page of them.
  const taken = reserved + sold;
  const other = Math.max(0, totalUnits - available - taken);
  const occupancyPct = totalUnits > 0 ? Math.round((taken / totalUnits) * 100) : null;
  const pct = (n: number) => (totalUnits > 0 ? (n / totalUnits) * 100 : 0);
  const mix = [
    { key: 'available', label: m.mixAvailable, n: available, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { key: 'reserved', label: m.mixReserved, n: reserved, bar: 'bg-amber-500', dot: 'bg-amber-500' },
    { key: 'sold', label: m.mixSold, n: sold, bar: 'bg-brand-500', dot: 'bg-brand-500' },
    ...(other > 0 ? [{ key: 'other', label: m.mixOther, n: other, bar: 'bg-slate-400', dot: 'bg-slate-400' }] : []),
  ];
  const facts = [
    project.type ? pf.projectTypes[project.type] : null,
    project.totalArea ? `${pf.labelTotalArea}: ${project.totalArea.toLocaleString('en-US')}` : null,
    project.licenseNumber ? `${pf.labelLicense}: ${project.licenseNumber}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* ── Hero: the cover across the page ─────────────────────────────── */}
      <section
        data-testid="project-hero"
        className="relative isolate overflow-hidden rounded-[26px] border border-hairline bg-surface"
      >
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#070b14] via-[#070b14]/80 to-[#070b14]/30" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-bl from-brand-500/[0.14] via-transparent to-transparent" />
        )}
        <div className={cn('flex flex-col gap-6 p-7 sm:p-9', cover && 'min-h-[320px] justify-end')}>
          <nav aria-label="breadcrumb">
            <ol className={cn('flex flex-wrap items-center gap-1.5 text-[13px]', cover ? 'text-white/70' : 'text-slate-500')}>
              <li><Link href={'/dashboard' as never} className="hover:text-brand-400">{m.breadcrumbDashboard}</Link></li>
              <li aria-hidden>›</li>
              <li><Link href={'/dashboard/projects' as never} className="hover:text-brand-400">{m.breadcrumbProjects}</Link></li>
              <li aria-hidden>›</li>
              <li className="font-semibold text-brand-400">{tx(project.name)}</li>
            </ol>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <ProjectStatusBadge status={project.status} locale={locale} />
                {project.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/90 px-3 py-0.5 text-[12px] font-bold text-[#1a1408]">
                    <Star className="h-3 w-3" /> {m.badgeFeatured}
                  </span>
                )}
              </div>
              <h1
                className={cn(
                  'mt-3 font-heading text-[34px] font-bold leading-tight sm:text-[42px]',
                  cover ? 'text-white' : 'text-slate-900',
                )}
              >
                {tx(project.name)}
              </h1>
              <p className={cn('mt-2 inline-flex items-center gap-1.5 text-[14px]', cover ? 'text-white/80' : 'text-slate-500')}>
                <MapPin className="h-4 w-4 text-brand-400" />
                {project.district ? `${project.district} · ` : ''}
                {project.city}
              </p>
              {facts.length > 0 && (
                <div data-testid="project-data" className="mt-4 flex flex-wrap gap-2">
                  {facts.map((f) => (
                    <span
                      key={f}
                      className={cn(
                        'rounded-full px-3 py-1 text-[12.5px] font-medium backdrop-blur',
                        cover ? 'bg-white/10 text-white ring-1 ring-white/20' : 'bg-surface-muted text-slate-700',
                      )}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/dashboard/projects/${id}/edit` as never}>
                  <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} className={cn(cover && 'border-white/30 bg-black/20 text-white backdrop-blur hover:bg-black/30')}>
                    {m.btnEditProject}
                  </Button>
                </Link>
                <Link href={`/dashboard/projects/${id}/models` as never}>
                  <Button variant="outline" size="sm" leftIcon={<Shapes className="h-4 w-4" />} className={cn(cover && 'border-white/30 bg-black/20 text-white backdrop-blur hover:bg-black/30')}>
                    {uiT(locale).pages.units.models.manage}
                  </Button>
                </Link>
                {project.status === 'PUBLISHED' ? (
                  <form action={archiveProjectAction.bind(null, id)}>
                    <Button type="submit" variant="outline" size="sm" leftIcon={<Archive className="h-4 w-4" />} className={cn(cover && 'border-white/30 bg-black/20 text-white backdrop-blur hover:bg-black/30')}>
                      {m.btnUnpublish}
                    </Button>
                  </form>
                ) : (
                  <form action={publishProjectAction.bind(null, id)}>
                    <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="h-4 w-4" />}>
                      {project.status === 'ARCHIVED' ? m.btnRepublish : m.btnPublishProject}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Key figures ─────────────────────────────────────────────────── */}
      <div data-testid="project-kpis" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid grid-cols-3 overflow-hidden rounded-[22px] border border-hairline bg-surface">
          {[
            { label: m.statTotalUnits, value: totalUnits, icon: <Building2 /> },
            { label: m.statPhases, value: phaseCount, icon: <Layers /> },
            { label: m.statBuildings, value: buildingCount, icon: <Home /> },
          ].map((k, i) => (
            <div key={k.label} className={cn('flex flex-col gap-3 p-5', i > 0 && 'border-s border-hairline')}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-4 [&_svg]:w-4">
                {k.icon}
              </span>
              <div>
                <p className="num text-[34px] font-semibold leading-none text-slate-900">{k.value}</p>
                <p className="mt-1.5 text-[12.5px] font-semibold text-slate-500">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-[22px] border border-hairline bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-semibold text-slate-500">{m.statOccupancy}</p>
              <p className="num mt-1 text-[34px] font-semibold leading-none text-brand-700">
                {occupancyPct !== null ? `${occupancyPct}%` : '—'}
              </p>
            </div>
            <p className="pt-1 text-[12px] text-slate-500 tabular-nums">{m.soldOf(taken, totalUnits)}</p>
          </div>
          <div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
              {mix.map((x) => (
                <span key={x.key} className={cn('h-full', x.bar)} style={{ width: `${pct(x.n)}%` }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-slate-500">
              {mix.map((x) => (
                <span key={x.key} className="inline-flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', x.dot)} />
                  {x.label}
                  <span className="font-semibold text-slate-900 tabular-nums">{x.n}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <PremiumPanel title={m.sectionDescription}>
            <p className="text-[14px] leading-relaxed text-slate-700">
              {tx(project.description) || m.noDescription}
            </p>
            {project.services && project.services.length > 0 && (
              <div className="mt-6 border-t border-hairline pt-5">
                <p className="mb-3 text-[12.5px] font-semibold text-slate-500">{m.servicesTitle}</p>
                <ServiceTileGrid services={project.services} />
              </div>
            )}
          </PremiumPanel>

          {/* Phases */}
          <PremiumPanel title={m.sectionPhases} sub={m.phasesCountLabel(phaseCount, buildingCount)}>
            {phaseCount === 0 ? (
              <PremiumEmptyNote>
                <span className="block font-semibold text-slate-700">{m.emptyPhasesTitle}</span>
                {m.emptyPhasesDesc}
              </PremiumEmptyNote>
            ) : (
              <div className="space-y-4">
                {project.phases!.map((ph, idx) => {
                  const buildingsCount = ph.buildings?.length ?? 0;
                  const totalPhaseUnits =
                    ph.buildings?.reduce((s, b) => s + (b._count?.units ?? 0), 0) ?? 0;
                  return (
                    <div key={ph.id} className="rounded-2xl border border-hairline bg-surface-muted/30 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <span className="num inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[18px] font-semibold text-[#1a1408]">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <p className="text-[15px] font-bold text-slate-900">{tx(ph.name)}</p>
                            <p className="mt-0.5 text-[12.5px] text-slate-500">
                              {m.phaseBuildingsUnitsLabel(buildingsCount, totalPhaseUnits)}
                            </p>
                          </div>
                        </div>
                        {isAdmin ? (
                          <PhaseDeliveryForm
                            projectId={project.id}
                            phaseId={ph.id}
                            deliveryDate={ph.deliveryDate}
                            locale={locale}
                          />
                        ) : (
                          ph.deliveryDate && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[12px] text-slate-600">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {m.phaseDeliveryLabel}: {ph.deliveryDate.slice(0, 10)}
                            </span>
                          )
                        )}
                      </div>

                      {ph.buildings && ph.buildings.length > 0 && (
                        <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {ph.buildings.map((b) => (
                            <li key={b.id} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3.5 py-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700">
                                <Building2 className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[13.5px] font-semibold text-slate-900">{m.buildingLabel(b.name)}</p>
                                <p className="text-[12px] text-slate-500">
                                  {m.buildingFloorsUnitsLabel(b.totalFloors, b._count?.units ?? 0)}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {isAdmin && (
                        <details className="group mt-3">
                          <summary className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:text-brand-600">
                            <Plus className="h-3.5 w-3.5" /> {m.addBuildingLabel}
                          </summary>
                          <BuildingCreateForm projectId={project.id} phaseId={ph.id} locale={locale} />
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isAdmin && (
              <details className="group mt-4 rounded-2xl border border-dashed border-hairline px-5 py-3.5">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-600">
                  <Plus className="h-4 w-4" /> {m.addPhaseLabel}
                </summary>
                <PhaseCreateForm projectId={project.id} nextOrder={phaseCount} locale={locale} />
              </details>
            )}
          </PremiumPanel>

          {/* Units */}
          <PremiumPanel
            title={m.sectionAvailableUnits}
            sub={m.unitsSub}
            link={{ href: `/dashboard/units?projectId=${project.id}`, label: m.viewAllUnits }}
            padding="none"
          >
            {units.length === 0 ? (
              <div className="px-6 pb-6">
                <PremiumEmptyNote>
                  <span className="block font-semibold text-slate-700">{m.emptyUnitsTitle}</span>
                  {m.emptyUnitsDesc}
                </PremiumEmptyNote>
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-hairline">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline">
                      {[m.colUnitNumber, m.colType, m.colArea, m.colPrice, m.colStatus].map((h, i) => (
                        <th key={h} className={cn('px-3 py-3 text-start text-[11.5px] font-semibold text-slate-500', i === 0 && 'ps-6')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {units.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-surface-muted/40">
                        <td className="py-3.5 pe-3 ps-6">
                          <Link href={`/dashboard/units/${u.id}` as never} className="font-mono text-[13.5px] font-bold text-slate-900 hover:text-brand-700">
                            {u.code}
                          </Link>
                        </td>
                        <td className="px-3 py-3.5 text-[13px] text-slate-600">{u.type}</td>
                        <td className="px-3 py-3.5 text-[13px] text-slate-700 tabular-nums">
                          {u.area} {m.areaSuffix}
                        </td>
                        <td className="px-3 py-3.5 text-[13.5px] font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(u.price, currency, locale)}
                        </td>
                        <td className="px-3 py-3.5">
                          <UnitStatusBadge status={u.status} locale={locale} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PremiumPanel>
        </div>

        {/* ── Side ─────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <PremiumPanel title={m.sectionMap}>
            <div className="overflow-hidden rounded-2xl border border-hairline">
              <ProjectMap lat={project.lat} lng={project.lng} city={project.city} height="md" />
            </div>
            <p className="mt-3 font-mono text-[11.5px] text-slate-500" dir="ltr">
              {project.lat.toFixed(5)}, {project.lng.toFixed(5)}
            </p>
          </PremiumPanel>

          <div id="media">
            <ProjectMediaPanel project={project} locale={locale} />
          </div>

          {isAdmin && (
            <PremiumPanel title={m.sectionDanger} className="border-danger-500/25">
              <p className="mb-4 text-[12.5px] leading-relaxed text-slate-500">{m.dangerDesc}</p>
              <ConfirmButton
                label={m.btnDeleteProject}
                confirm={m.deleteConfirm}
                action={deleteProjectAction.bind(null, id)}
              />
            </PremiumPanel>
          )}
        </div>
      </div>
    </div>
  );
}
