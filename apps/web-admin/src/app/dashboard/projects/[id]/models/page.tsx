import { redirect } from 'next/navigation';
import { LayoutTemplate, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Project, UnitModelOption, UnitTypeOption } from '@/lib/types';
import { tx } from '@/lib/format';
import { getLocale, type Locale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { createUnitModelAction, setUnitModelActiveAction, updateUnitModelAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const AREAS = ['area', 'netArea', 'gardenArea', 'roofArea', 'terraceArea', 'landArea'] as const;

/** A model's name in one language, for its edit field ('' for a new one). */
function nameIn(name: UnitModelOption['name'] | undefined, lang: 'ar' | 'en'): string {
  if (!name) return '';
  return typeof name === 'string' ? name : (name[lang] ?? '');
}

/** The layout fields of a model, empty for a new one. */
function LayoutFields({ model, types, locale }: { model?: UnitModelOption; types: UnitTypeOption[]; locale: Locale }) {
  const unitsM = uiT(locale).pages.units;
  const m = unitsM.models;
  const label = (text: string, field: React.ReactNode, wide = false) => (
    <label className={`flex flex-col gap-1 text-sm ${wide ? 'col-span-2' : ''}`}>
      <span className="text-slate-600">{text}</span>
      {field}
    </label>
  );
  return (
    <>
      {label(m.nameAr, <Input name="ar" required dir="rtl" defaultValue={nameIn(model?.name, 'ar')} />)}
      {label(m.nameEn, <Input name="en" required dir="ltr" defaultValue={nameIn(model?.name, 'en')} />)}
      {label(
        m.type,
        <Select name="type" defaultValue={model?.type ?? types[0]?.code}>
          {types
            .filter((t) => t.active || t.code === model?.type)
            .map((t) => (
              <option key={t.code} value={t.code}>{tx(t.name, locale) || t.code}</option>
            ))}
        </Select>,
      )}
      {AREAS.map((f) =>
        label(
          `${unitsM.specLabels[f] ?? f} (m²)`,
          <Input
            key={f}
            name={f}
            type="number"
            step="any"
            min={0}
            required={f === 'area'}
            defaultValue={model?.[f] ?? undefined}
          />,
        ),
      )}
      {label(m.bedrooms, <Input name="bedrooms" type="number" min={0} defaultValue={model?.bedrooms ?? 0} />)}
      {label(m.bathrooms, <Input name="bathrooms" type="number" min={0} defaultValue={model?.bathrooms ?? 0} />)}
      {label(
        unitsM.specLabels.finishing ?? '',
        <Select name="finishing" defaultValue={model?.finishing ?? ''}>
          <option value="">—</option>
          {Object.entries(unitsM.finishingLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>,
      )}
    </>
  );
}

/**
 * A project's unit models (F10): the layouts its units are entered from.
 * Picking one on the unit form fills the unit; editing a model changes no
 * unit already entered.
 */
export default async function ProjectModelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [{ id }, sp, locale, session] = await Promise.all([params, searchParams, getLocale(), getSession()]);
  if (session?.role !== 'ADMIN') redirect(`/dashboard/projects/${id}` as never);
  const [projectRes, modelsRes, typesRes] = await Promise.all([
    safe(api.get<Project>(`/projects/${id}`)),
    safe(api.get<UnitModelOption[]>(`/projects/${id}/unit-models`)),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
  ]);
  const m = uiT(locale).pages.units.models;
  const types = typesRes.data ?? [];
  const models = modelsRes.data ?? [];
  const projectName = tx(projectRes.data?.name, locale) || '';

  return (
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: projectName, href: `/dashboard/projects/${id}` },
          { label: m.title },
        ]}
      />

      {sp.err && (
        <div role="alert" className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && !sp.err && (
        <div className="rounded-[20px] bg-success-50 border border-success-100 text-success-700 px-4 py-3 text-sm">
          {m.saved}
        </div>
      )}
      {(modelsRes.error || projectRes.error) && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {modelsRes.error ?? projectRes.error}
        </div>
      )}

      <PremiumSectionCard title={m.add} icon={<Plus />}>
        <form
          action={createUnitModelAction.bind(null, id)}
          data-testid="unit-model-add"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{m.code}</span>
            <Input name="code" required dir="ltr" placeholder="A" />
          </label>
          <LayoutFields types={types} locale={locale} />
          <Button type="submit" variant="primary" size="md">{m.add}</Button>
        </form>
      </PremiumSectionCard>

      <PremiumSectionCard title={m.title} icon={<LayoutTemplate />}>
        {models.length === 0 ? (
          <p className="text-sm text-slate-500">{m.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {models.map((x) => (
              <li key={x.id} data-testid="unit-model-row" className="py-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono font-bold text-navy" dir="ltr">{x.code}</span>
                  <span className="text-slate-500">{m.unitsCount.replace('{n}', String(x._count?.units ?? 0))}</span>
                  {!x.active && (
                    <span className="text-xs rounded-full bg-surface-muted text-slate-600 px-2 py-0.5">{m.inactive}</span>
                  )}
                </div>
                <form
                  action={updateUnitModelAction.bind(null, id, x.id)}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
                >
                  <LayoutFields model={x} types={types} locale={locale} />
                  <Button type="submit" variant="outline" size="md">{m.save}</Button>
                </form>
                <form action={setUnitModelActiveAction.bind(null, id, x.id, !x.active)}>
                  <Button type="submit" variant={x.active ? 'ghost' : 'outline'} size="sm">
                    {x.active ? m.deactivate : m.activate}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </PremiumSectionCard>
    </div>
  );
}
