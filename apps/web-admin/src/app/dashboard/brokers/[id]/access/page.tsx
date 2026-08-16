import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Building2, Home } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerAccessBundle, Paged, Project, Unit } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs } from '@/components/ui/tabs';
import { ConfirmingForm } from '@/components/confirming-form';
import { ProjectStatusBadge, UnitStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { UnitAccessGrantForm } from './_unit-access-form';
import {
  grantProjectAccessAction,
  revokeProjectAccessAction,
  grantUnitAccessAction,
  revokeUnitAccessAction,
} from '../../actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

type Tab = 'projects' | 'units';

export default async function BrokerAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'units' ? 'units' : 'projects';

  const locale = await getLocale();
  const m = uiT(locale).pages.brokerAccessPage;

  const [brokerRes, accessRes, projectsRes, unitsRes] = await Promise.all([
    safe(api.get<Broker>(`/brokers/${id}`)),
    safe(api.get<BrokerAccessBundle>(`/brokers/${id}/access`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    tab === 'units'
      ? safe(api.get<Paged<Unit>>('/units?pageSize=500'))
      : Promise.resolve({ data: null, error: null } as const),
  ]);
  if (brokerRes.error || !brokerRes.data) notFound();

  const broker = brokerRes.data;
  const access = accessRes.data ?? { projects: [], units: [] };
  const allProjects = projectsRes.data?.data ?? [];
  const allUnits = unitsRes.data?.data ?? [];

  async function revokeProject(projectId: string) {
    'use server';
    await revokeProjectAccessAction(id, projectId);
  }
  async function revokeUnit(unitId: string) {
    'use server';
    await revokeUnitAccessAction(id, unitId);
  }
  async function grantProject(formData: FormData) {
    'use server';
    await grantProjectAccessAction(id, formData);
  }
  async function grantUnit(formData: FormData) {
    'use server';
    await grantUnitAccessAction(id, formData);
  }

  return (
    <div className="space-y-5">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.heroTitle}
        description={m.heroDescription(broker.companyName)}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: broker.companyName, href: `/dashboard/brokers/${id}` as never },
          { label: m.breadcrumbPermissions },
        ]}
        meta={
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            <span>{m.defaultRateLabel}</span>
            <span className="font-semibold text-slate-900">
              {Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%
            </span>
          </div>
        }
        actions={
          <Link href={`/dashboard/brokers/${id}` as never}>
            <Button variant="outline" size="md">{m.backBtn}</Button>
          </Link>
        }
      />

      {/* ── Error ────────────────────────────────────────────────────── */}
      {accessRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.errorLoad}{accessRes.error}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs
        items={[
          {
            label: m.tabProjects,
            href: `/dashboard/brokers/${id}/access?tab=projects`,
            count: access.projects.length,
          },
          {
            label: m.tabUnits,
            href: `/dashboard/brokers/${id}/access?tab=units`,
            count: access.units.length,
          },
        ]}
        activeHref={`/dashboard/brokers/${id}/access?tab=${tab}`}
      />

      {/* ── Projects tab ─────────────────────────────────────────────── */}
      {tab === 'projects' && (
        <>
          {/* Grant form */}
          <PremiumSectionCard title={m.grantProjectTitle} icon={<Building2 />}>
            <p className="text-[12px] text-slate-500 mb-5">
              {m.grantProjectNote}
            </p>
            <form action={grantProject} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label={m.fieldProject}>
                <Select id="projectId" name="projectId" required defaultValue="">
                  <option value="" disabled>{m.projectPlaceholder}</option>
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {tx(p.name)} — {p.city}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={m.fieldCommissionPct} hint={m.fieldCommissionPctHint}>
                <Input id="commissionPct" name="commissionPct" type="number" min={0} max={100} step="0.01" />
              </FormField>
              <FormField label={m.fieldFixedAmount} hint={m.fieldFixedAmountHint}>
                <Input id="fixedAmountPerUnit" name="fixedAmountPerUnit" type="number" min={0} step="0.01" />
              </FormField>
              <FormField label={m.fieldStartsAt}>
                <Input id="startsAt" name="startsAt" type="date" />
              </FormField>
              <FormField label={m.fieldEndsAt}>
                <Input id="endsAt" name="endsAt" type="date" />
              </FormField>
              {/* active checkbox + submit on the same row */}
              <div className="flex items-end justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none h-10">
                  <Checkbox name="active" defaultChecked />
                  <span>{m.activeLabel}</span>
                </label>
                <Button type="submit" variant="primary" size="md">{m.btnGrantProject}</Button>
              </div>
            </form>
          </PremiumSectionCard>

          {/* Projects list */}
          <PremiumSectionCard
            title={m.projectsGrantedTitle}
            icon={<Building2 />}
            trailing={
              <span className="text-xs text-slate-400 tabular-nums">{access.projects.length} {m.projectSuffix}</span>
            }
            padded={false}
          >
            {access.projects.length === 0 ? (
              <PremiumEmptyState
                icon={<Building2 />}
                title={m.noProjectsTitle}
                description={m.noProjectsDesc}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-canvas/50 border-b border-hairline">
                    <tr>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colProject}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colStatus}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colCommission}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colValidity}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colAdded}</th>
                      <th className="px-5 py-3 text-start w-px"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {access.projects.map((pa) => {
                      const pct =
                        pa.commissionPct != null
                          ? `${Number(pa.commissionPct).toFixed(2)}%`
                          : null;
                      const fixed =
                        pa.fixedAmountPerUnit != null
                          ? `${Number(pa.fixedAmountPerUnit).toFixed(2)} ${m.perUnitSuffix}`
                          : null;
                      return (
                        <tr
                          key={pa.id}
                          className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                        >
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/dashboard/projects/${pa.projectId}` as never}
                              className="text-[13px] font-semibold text-slate-900 hover:text-brand-700 transition-colors"
                            >
                              {tx(pa.project.name)}
                            </Link>
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{pa.project.city}</span>
                              <span>•</span>
                              <ProjectStatusBadge status={pa.project.status} />
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            {pa.active ? (
                              <span className="inline-flex items-center rounded-full bg-success-50 border border-success-100 text-success-700 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                                {m.statusActive}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                                {m.statusInactive}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[12px] font-medium text-slate-700" dir="ltr">
                              {pct ?? fixed ?? (
                                <span className="text-slate-400 font-normal">{m.commissionDefault}</span>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[11px] text-slate-500 tabular-nums" dir="ltr">
                              {pa.startsAt || pa.endsAt
                                ? `${formatDate(pa.startsAt) ?? '—'} → ${formatDate(pa.endsAt) ?? '—'}`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {formatDate(pa.createdAt)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {pa.active && (
                              <ConfirmingForm
                                action={revokeProject.bind(null, pa.projectId)}
                                confirmMessage={m.revokeConfirm(tx(pa.project.name))}
                              >
                                <button
                                  type="submit"
                                  className="inline-flex items-center rounded-lg bg-danger-50 border border-danger-100 px-2.5 py-1 text-[11px] font-semibold text-danger-700 hover:bg-danger-100 transition-colors whitespace-nowrap"
                                >
                                  {m.revokeBtn}
                                </button>
                              </ConfirmingForm>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PremiumSectionCard>
        </>
      )}

      {/* ── Units tab ────────────────────────────────────────────────── */}
      {tab === 'units' && (
        <>
          {/* Grant form */}
          <PremiumSectionCard title={m.grantUnitTitle} icon={<Home />}>
            <p className="text-[12px] text-slate-500 mb-5">
              {m.grantUnitNote}
            </p>
            <UnitAccessGrantForm action={grantUnit} allUnits={allUnits} projects={allProjects} locale={locale} />
          </PremiumSectionCard>

          {/* Units list */}
          <PremiumSectionCard
            title={m.unitsRestrictedTitle}
            icon={<Home />}
            trailing={
              <span className="text-xs text-slate-400 tabular-nums">{access.units.length} {m.unitSuffix}</span>
            }
            padded={false}
          >
            {access.units.length === 0 ? (
              <PremiumEmptyState
                icon={<Home />}
                title={m.noUnitsTitle}
                description={m.noUnitsDesc}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-canvas/50 border-b border-hairline">
                    <tr>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colUnit}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colBuilding}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colUnitStatus}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colPermission}</th>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colAdded}</th>
                      <th className="px-5 py-3 text-start w-px"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {access.units.map((ua) => (
                      <tr
                        key={ua.id}
                        className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-semibold font-mono text-slate-900" dir="ltr">
                            {ua.unit.code}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{ua.unit.type}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] text-slate-600">
                            {ua.unit.building?.name ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <UnitStatusBadge status={ua.unit.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          {ua.active ? (
                            <span className="inline-flex items-center rounded-full bg-success-50 border border-success-100 text-success-700 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                              {m.statusActive}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                              {m.statusInactive}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {formatDate(ua.createdAt)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {ua.active && (
                            <ConfirmingForm
                              action={revokeUnit.bind(null, ua.unitId)}
                              confirmMessage={m.revokeUnitConfirm(ua.unit.code)}
                            >
                              <button
                                type="submit"
                                className="inline-flex items-center rounded-lg bg-danger-50 border border-danger-100 px-2.5 py-1 text-[11px] font-semibold text-danger-700 hover:bg-danger-100 transition-colors whitespace-nowrap"
                              >
                                {m.revokeBtn}
                              </button>
                            </ConfirmingForm>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PremiumSectionCard>
        </>
      )}

    </div>
  );
}
