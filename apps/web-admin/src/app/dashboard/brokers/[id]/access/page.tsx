import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Building2, Home } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import type { Broker, BrokerAccessBundle } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmingForm } from '@/components/confirming-form';
import { ProjectStatusBadge, UnitStatusBadge } from '@/components/badges';
import { PremiumPageHero } from '@/components/premium';
import { Avatar } from '@/components/cockpit/cockpit';
import { UnitAccessGrantForm } from './_unit-access-form';
import {
  grantProjectAccessAction,
  revokeProjectAccessAction,
  grantUnitAccessAction,
  revokeUnitAccessAction,
} from '../../actions';
import { EntityLink } from '@/components/entity-link';

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
      <p className="text-[12.5px] font-semibold text-slate-700">{label}</p>
      {children}
      {hint && <p className="text-[11.5px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** A checkbox styled as a switch; the form still posts `name=on`. */
function Switch({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-500/25 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#C9A24E] peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
    </label>
  );
}

function Section({ icon, title, note, trailing, children }: { icon: React.ReactNode; title: string; note?: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-hairline bg-surface">
      <header className="flex items-center gap-3 px-6 py-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A] [&_svg]:h-[18px] [&_svg]:w-[18px]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{title}</h2>
          {note && <p className="mt-0.5 text-[12.5px] text-slate-500">{note}</p>}
        </div>
        {trailing}
      </header>
      {children}
    </section>
  );
}

function Chip({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold ${on ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/12 text-slate-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {on ? onLabel : offLabel}
    </span>
  );
}

function Empty({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-hairline px-6 py-10 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A] [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <p className="text-[14px] font-semibold text-slate-700">{title}</p>
      <p className="max-w-sm text-[12.5px] text-slate-500">{desc}</p>
    </div>
  );
}

const REVOKE_BTN =
  'inline-flex items-center whitespace-nowrap rounded-full border border-danger-500/40 px-3 py-1 text-[12px] font-bold text-danger-600 transition-colors hover:bg-danger-500/10';

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

  const [brokerRes, accessRes, projectsRes] = await Promise.all([
    safe(api.get<Broker>(`/brokers/${id}`)),
    safe(api.get<BrokerAccessBundle>(`/brokers/${id}/access`)),
    safe(projectOptions()),
  ]);
  if (brokerRes.error || !brokerRes.data) notFound();

  const broker = brokerRes.data;
  const access = accessRes.data ?? { projects: [], units: [] };
  const allProjects = projectsRes.data?.data ?? [];

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

  const fixedHint = locale === 'en' ? 'For the fixed-amount-per-unit model' : 'عند نموذج مبلغ ثابت لكل وحدة';
  const tabHref = (t: Tab) => `/dashboard/brokers/${id}/access?tab=${t}`;

  return (
    <div className="space-y-6">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D8B66A]/[0.16] px-3 py-1 text-[12px] font-semibold text-[#9A7A2E] dark:text-[#D8B66A]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {m.defaultRateLabel}
            <b className="tabular-nums">{Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%</b>
          </span>
        }
      />

      {accessRes.error && (
        <div className="rounded-[22px] border border-danger-500/25 bg-danger-500/10 p-4 text-sm text-danger-600">
          {m.errorLoad}{accessRes.error}
        </div>
      )}

      {/* Segmented tabs */}
      <nav data-testid="access-tabs" className="inline-flex rounded-full border border-hairline bg-surface p-1">
        {([
          ['projects', m.tabProjects, access.projects.length, <Building2 key="p" />],
          ['units', m.tabUnits, access.units.length, <Home key="u" />],
        ] as const).map(([t, label, count, icon]) => {
          const on = tab === t;
          return (
            <Link
              key={t}
              href={tabHref(t) as never}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition-colors [&_svg]:h-4 [&_svg]:w-4 ${on ? 'bg-[#D8B66A]/[0.16] text-[#9A7A2E] dark:text-[#D8B66A]' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {icon}
              {label}
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums ${on ? 'bg-[#C9A24E] text-[#1a1408]' : 'bg-surface-muted text-slate-500'}`}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {tab === 'projects' && (
        <>
          <Section icon={<Building2 />} title={m.grantProjectTitle} note={m.grantProjectNote}>
            <form action={grantProject} className="grid grid-cols-1 gap-5 border-t border-hairline px-6 py-6 md:grid-cols-2">
              <div className="md:col-span-2">
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
              </div>
              <FormField label={m.fieldCommissionPct} hint={m.fieldCommissionPctHint}>
                <Input id="commissionPct" name="commissionPct" type="number" min={0} max={100} step="0.01" placeholder={Number(broker.defaultCommissionPct ?? 0).toFixed(2)} />
              </FormField>
              <FormField label={m.fieldFixedAmount} hint={fixedHint}>
                <Input id="fixedAmountPerUnit" name="fixedAmountPerUnit" type="number" min={0} step="0.01" />
              </FormField>
              <FormField label={m.fieldStartsAt}>
                <Input id="startsAt" name="startsAt" type="date" />
              </FormField>
              <FormField label={m.fieldEndsAt}>
                <Input id="endsAt" name="endsAt" type="date" />
              </FormField>
              <div className="flex items-center justify-between gap-4 border-t border-hairline pt-5 md:col-span-2">
                <Switch name="active" label={m.activeLabel} defaultChecked />
                <Button type="submit" variant="primary" size="md">{m.btnGrantProject}</Button>
              </div>
            </form>
          </Section>

          <Section
            icon={<Building2 />}
            title={m.projectsGrantedTitle}
            trailing={<span className="text-[12.5px] tabular-nums text-slate-500">{access.projects.length} {m.projectSuffix}</span>}
          >
            {access.projects.length === 0 ? (
              <Empty icon={<Building2 />} title={m.noProjectsTitle} desc={m.noProjectsDesc} />
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {access.projects.map((pa) => {
                  const pct = pa.commissionPct != null ? `${Number(pa.commissionPct).toFixed(2)}%` : null;
                  const fixed = pa.fixedAmountPerUnit != null ? `${Number(pa.fixedAmountPerUnit).toFixed(2)} ${m.perUnitSuffix}` : null;
                  return (
                    <li
                      key={pa.id}
                      data-testid="access-project-row"
                      className="grid grid-cols-1 items-center gap-x-6 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)_minmax(0,1fr)_110px_120px]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={tx(pa.project.name)} />
                        <div className="min-w-0">
                          <Link href={`/dashboard/projects/${pa.projectId}` as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                            {tx(pa.project.name)}
                          </Link>
                          <p className="mt-1 flex items-center gap-2 text-[12px] text-slate-500">
                            {pa.project.city}
                            <ProjectStatusBadge status={pa.project.status} />
                          </p>
                        </div>
                      </div>
                      <Chip on={pa.active} onLabel={m.statusActive} offLabel={m.statusInactive} />
                      <div className="text-[12.5px]">
                        <p className="text-[11px] text-slate-500">{m.colCommission}</p>
                        <p className="font-bold text-slate-900" dir="auto">{pct ?? fixed ?? <span className="font-semibold text-slate-500">{m.commissionDefault}</span>}</p>
                      </div>
                      <div className="text-[12.5px]">
                        <p className="text-[11px] text-slate-500">{m.colValidity}</p>
                        <p className="font-semibold tabular-nums text-slate-800">
                          {pa.startsAt || pa.endsAt ? `${formatDate(pa.startsAt, locale) ?? '—'} ← ${formatDate(pa.endsAt, locale) ?? '—'}` : '—'}
                        </p>
                      </div>
                      <div className="text-[12.5px]">
                        <p className="text-[11px] text-slate-500">{m.colAdded}</p>
                        <p className="font-semibold tabular-nums text-slate-800">{formatDate(pa.createdAt, locale)}</p>
                      </div>
                      <div className="lg:justify-self-end">
                        {pa.active && (
                          <ConfirmingForm action={revokeProject.bind(null, pa.projectId)} confirmMessage={m.revokeConfirm(tx(pa.project.name))}>
                            <button type="submit" className={REVOKE_BTN}>{m.revokeBtn}</button>
                          </ConfirmingForm>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}

      {tab === 'units' && (
        <>
          <Section icon={<Home />} title={m.grantUnitTitle} note={m.grantUnitNote}>
            <div className="border-t border-hairline px-6 py-6">
              <UnitAccessGrantForm action={grantUnit} projects={allProjects} locale={locale} />
            </div>
          </Section>

          <Section
            icon={<Home />}
            title={m.unitsRestrictedTitle}
            trailing={<span className="text-[12.5px] tabular-nums text-slate-500">{access.units.length} {m.unitSuffix}</span>}
          >
            {access.units.length === 0 ? (
              <Empty icon={<Home />} title={m.noUnitsTitle} desc={m.noUnitsDesc} />
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {access.units.map((ua) => (
                  <li
                    key={ua.id}
                    data-testid="access-unit-row"
                    className="grid grid-cols-1 items-center gap-x-6 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_110px_110px_120px]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                        <Home className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-[14px] font-bold text-slate-900">
                          <EntityLink kind="unit" id={ua.unitId}>{ua.unit.code}</EntityLink>
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500">{ua.unit.type}</p>
                      </div>
                    </div>
                    <div className="text-[12.5px]">
                      <p className="text-[11px] text-slate-500">{m.colBuilding}</p>
                      <p className="font-semibold text-slate-800">{ua.unit.building?.name ?? '—'}</p>
                    </div>
                    <UnitStatusBadge status={ua.unit.status} />
                    <Chip on={ua.active} onLabel={m.statusActive} offLabel={m.statusInactive} />
                    <div className="text-[12.5px]">
                      <p className="text-[11px] text-slate-500">{m.colAdded}</p>
                      <p className="font-semibold tabular-nums text-slate-800">{formatDate(ua.createdAt, locale)}</p>
                    </div>
                    <div className="lg:justify-self-end">
                      {ua.active && (
                        <ConfirmingForm action={revokeUnit.bind(null, ua.unitId)} confirmMessage={m.revokeUnitConfirm(ua.unit.code)}>
                          <button type="submit" className={REVOKE_BTN}>{m.revokeBtn}</button>
                        </ConfirmingForm>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
