import { redirect } from 'next/navigation';
import { Plus, Radio } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { LeadSource } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { createSourceAction, setSourceActiveAction, updateSourceAction } from '../actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Lead sources (F12). The API had create-only endpoints and no screen used
 * them, so a company had only the sources it was seeded with — a company
 * created from the platform had none.
 */
export default async function LeadSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [sp, locale, session] = await Promise.all([searchParams, getLocale(), getSession()]);
  // Managing sources is ADMIN-only on the API (lead_sources:manage).
  if (session?.role !== 'ADMIN' && !(await can('lead_sources:manage'))) redirect('/dashboard/leads' as never);
  const leadsM = uiT(locale).pages.leads;
  const m = leadsM.sources;
  const res = await safe(api.get<LeadSource[]>('/lead-sources'));
  const sources = res.data ?? [];

  return (
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: leadsM.breadcrumb, href: '/dashboard/leads' },
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
        <form action={createSourceAction} data-testid="lead-source-add" className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{m.nameAr}</span>
            <Input name="ar" required dir="rtl" />
          </label>
          <label className="flex-1 flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{m.nameEn}</span>
            <Input name="en" required dir="ltr" />
          </label>
          <Button type="submit" variant="primary" size="md">{m.add}</Button>
        </form>
      </PremiumSectionCard>

      <PremiumSectionCard title={m.title} icon={<Radio />}>
        {sources.length === 0 ? (
          <p className="text-sm text-slate-500">{m.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {sources.map((s) => {
              const name = typeof s.name === 'string' ? { ar: s.name, en: s.name } : s.name;
              return (
                <li key={s.id} data-testid="lead-source-row" className="py-3 flex flex-col lg:flex-row gap-3 lg:items-end">
                  <form action={updateSourceAction.bind(null, s.id)} className="flex-1 flex flex-col sm:flex-row gap-3 sm:items-end">
                    <label className="flex-1 flex flex-col gap-1 text-sm">
                      <span className="text-slate-600">{m.nameAr}</span>
                      <Input name="ar" required dir="rtl" defaultValue={name.ar ?? ''} />
                    </label>
                    <label className="flex-1 flex flex-col gap-1 text-sm">
                      <span className="text-slate-600">{m.nameEn}</span>
                      <Input name="en" required dir="ltr" defaultValue={name.en ?? ''} />
                    </label>
                    <Button type="submit" variant="outline" size="md">{m.save}</Button>
                  </form>
                  <form action={setSourceActiveAction.bind(null, s.id, !s.active)} className="flex items-center gap-3">
                    {!s.active && (
                      <span className="text-xs rounded-full bg-surface-muted text-slate-600 px-2 py-0.5">{m.inactive}</span>
                    )}
                    <Button type="submit" variant={s.active ? 'ghost' : 'outline'} size="md">
                      {s.active ? m.deactivate : m.activate}
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
