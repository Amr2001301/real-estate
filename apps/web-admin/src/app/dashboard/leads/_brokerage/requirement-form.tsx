'use client';

import { useActionState, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorLine } from '@/app/dashboard/deals/_components/ui';
import { listingsT, LISTING_KINDS } from '@/components/listings/messages';
import { developersT, type LeadRequirement } from '@/components/developers/messages';
import { saveRequirementAction, type MatchFormState } from './actions';

const label = 'block text-[12.5px] font-semibold text-slate-600';

/** What the lead is looking for: read, or edited in place. */
export function RequirementCard({
  leadId,
  requirement,
  unitTypes,
  locale,
  currency,
}: {
  leadId: string;
  requirement: LeadRequirement | null;
  unitTypes: Array<{ code: string; name: string }>;
  locale: Locale;
  currency: string;
}) {
  const t = developersT(locale).match;
  const lm = listingsT(locale);
  const [editing, setEditing] = useState(false);
  const [state, action, saving] = useActionState<MatchFormState, FormData>(async (prev, fd) => {
    const res = await saveRequirementAction(leadId, prev, fd);
    if (res.ok) setEditing(false);
    return res;
  }, {});
  const r = requirement;
  const money = (v: string | null) => (v ? formatCurrency(v, currency, locale) : null);
  const typeName = new Map(unitTypes.map((u) => [u.code, u.name]));

  if (editing) {
    return (
      <form action={action} className="space-y-4" data-testid="requirement-form">
        <ErrorLine error={state.error} />
        <fieldset>
          <legend className={label}>{t.kinds}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {LISTING_KINDS.map((k) => (
              <label key={k} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] font-bold text-slate-700 has-[:checked]:border-[#0E1626] has-[:checked]:bg-[#0E1626] has-[:checked]:text-[#F4ECD8] dark:has-[:checked]:border-[#D8B66A] dark:has-[:checked]:bg-[#D8B66A] dark:has-[:checked]:text-[#0E1626]">
                <input type="checkbox" name="kinds" value={k} defaultChecked={r?.kinds.includes(k)} className="sr-only" />
                {lm.kind[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            {t.budget} — {t.budgetMin}
            <Input name="budgetMin" type="number" min={0} step="1000" dir="ltr" defaultValue={r?.budgetMin ? Number(r.budgetMin) : ''} className="mt-1.5" />
          </label>
          <label className={label}>
            {t.budgetMax}
            <Input name="budgetMax" type="number" min={1} step="1000" dir="ltr" defaultValue={r?.budgetMax ? Number(r.budgetMax) : ''} className="mt-1.5" data-testid="req-budget-max" />
          </label>
          <label className={cn(label, 'col-span-2')}>
            {t.cities}
            <Input name="cities" defaultValue={r?.cities.join('، ') ?? ''} className="mt-1.5" placeholder={t.citiesHint} data-testid="req-cities" />
          </label>
          <label className={label}>
            {t.bedrooms}
            <Input name="bedroomsMin" type="number" min={0} max={20} dir="ltr" defaultValue={r?.bedroomsMin ?? ''} className="mt-1.5" />
          </label>
          <label className={label}>
            {t.area}
            <Input name="areaMin" type="number" min={1} dir="ltr" defaultValue={r?.areaMin ?? ''} className="mt-1.5" />
          </label>
        </div>
        {unitTypes.length > 0 && (
          <fieldset>
            <legend className={label}>{t.unitTypes}</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {unitTypes.map((u) => (
                <label key={u.code} className="inline-flex cursor-pointer items-center rounded-full border border-hairline px-3 py-1 text-[12px] font-bold text-slate-600 has-[:checked]:border-[#D8B66A] has-[:checked]:bg-[#D8B66A]/15 has-[:checked]:text-brand-700">
                  <input type="checkbox" name="unitTypes" value={u.code} defaultChecked={r?.unitTypes.includes(u.code)} className="sr-only" />
                  {u.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>{t.cancel}</Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving} data-testid="req-save">{t.save}</Button>
        </div>
      </form>
    );
  }

  const rows: Array<[string, string | null]> = r
    ? [
        [t.kinds, r.kinds.length ? r.kinds.map((k) => lm.kind[k]).join('، ') : t.any],
        [t.budget, r.budgetMin || r.budgetMax ? [money(r.budgetMin), money(r.budgetMax)].filter(Boolean).join(' — ') : t.any],
        [t.cities, r.cities.length ? r.cities.join('، ') : t.any],
        [t.unitTypes, r.unitTypes.length ? r.unitTypes.map((u) => typeName.get(u) ?? u).join('، ') : t.any],
        [t.bedrooms, r.bedroomsMin !== null ? String(r.bedroomsMin) : null],
        [t.area, r.areaMin !== null ? `${r.areaMin}` : null],
      ]
    : [];
  return (
    <div data-testid="requirement-card">
      {r ? (
        <dl className="space-y-2.5 text-[13.5px]">
          {rows
            .filter(([, v]) => v !== null)
            .map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="num text-end font-bold text-slate-900">{v}</dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="text-[13.5px] text-slate-500">{t.none}</p>
      )}
      <Button type="button" variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)} className="mt-4" data-testid="req-edit">
        {r ? t.edit : t.set}
      </Button>
    </div>
  );
}
