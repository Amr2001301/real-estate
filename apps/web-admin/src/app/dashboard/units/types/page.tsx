import { redirect } from 'next/navigation';
import { Plus, Shapes } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UnitTypeOption, UnitUsage } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { createUnitTypeAction, setUnitTypeActiveAction, updateUnitTypeAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const USAGES: UnitUsage[] = ['RESIDENTIAL', 'COMMERCIAL', 'ADMINISTRATIVE', 'MEDICAL', 'PARKING'];

/**
 * Unit types (F10). Units were typed from a fixed residential list in the
 * form, so a shop, an office, a clinic or a garage could not be entered.
 */
export default async function UnitTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [sp, locale, session] = await Promise.all([searchParams, getLocale(), getSession()]);
  if (session?.role !== 'ADMIN') redirect('/dashboard/units' as never);
  const unitsM = uiT(locale).pages.units;
  const m = unitsM.types;
  const res = await safe(api.get<UnitTypeOption[]>('/unit-types'));
  const types = res.data ?? [];

  const usageSelect = (value: UnitUsage) => (
    <Select name="usage" defaultValue={value} aria-label={m.usage}>
      {USAGES.map((u) => (
        <option key={u} value={u}>{unitsM.usageLabels[u]}</option>
      ))}
    </Select>
  );

  return (
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: unitsM.breadcrumb, href: '/dashboard/units' },
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
      {res.error && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {res.error}
        </div>
      )}

      <PremiumSectionCard title={m.add} icon={<Plus />}>
        <form action={createUnitTypeAction} data-testid="unit-type-add" className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{m.nameAr}</span>
            <Input name="ar" required dir="rtl" />
          </label>
          <label className="flex-1 flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{m.nameEn}</span>
            <Input name="en" required dir="ltr" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{m.usage}</span>
            {usageSelect('RESIDENTIAL')}
          </label>
          <Button type="submit" variant="primary" size="md">{m.add}</Button>
        </form>
      </PremiumSectionCard>

      <PremiumSectionCard title={m.title} icon={<Shapes />}>
        {types.length === 0 ? (
          <p className="text-sm text-slate-500">{m.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {types.map((t) => {
              const name = typeof t.name === 'string' ? { ar: t.name, en: t.name } : t.name;
              return (
                <li key={t.id} data-testid="unit-type-row" className="py-3 flex flex-col lg:flex-row gap-3 lg:items-end">
                  <form action={updateUnitTypeAction.bind(null, t.id)} className="flex-1 flex flex-col sm:flex-row gap-3 sm:items-end">
                    <label className="flex flex-col gap-1 text-sm sm:w-28">
                      <span className="text-slate-600">{m.code}</span>
                      <span className="h-10 flex items-center text-slate-500 font-mono text-xs" dir="ltr">{t.code}</span>
                    </label>
                    <label className="flex-1 flex flex-col gap-1 text-sm">
                      <span className="text-slate-600">{m.nameAr}</span>
                      <Input name="ar" required dir="rtl" defaultValue={name.ar ?? ''} />
                    </label>
                    <label className="flex-1 flex flex-col gap-1 text-sm">
                      <span className="text-slate-600">{m.nameEn}</span>
                      <Input name="en" required dir="ltr" defaultValue={name.en ?? ''} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-slate-600">{m.usage}</span>
                      {usageSelect(t.usage)}
                    </label>
                    <Button type="submit" variant="outline" size="md">{m.save}</Button>
                  </form>
                  <form action={setUnitTypeActiveAction.bind(null, t.id, !t.active)} className="flex items-center gap-3">
                    {!t.active && (
                      <span className="text-xs rounded-full bg-surface-muted text-slate-600 px-2 py-0.5">{m.inactive}</span>
                    )}
                    <Button type="submit" variant={t.active ? 'ghost' : 'outline'} size="md">
                      {t.active ? m.deactivate : m.activate}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </PremiumSectionCard>
    </div>
  );
}
