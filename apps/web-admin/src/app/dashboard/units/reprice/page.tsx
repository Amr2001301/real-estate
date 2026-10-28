import { redirect } from 'next/navigation';
import { Calculator } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UnitTypeOption } from '@/lib/types';
import { projectOptions } from '@/lib/options';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { RepriceForm } from './_reprice-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Reprice by the meter (F10): a new price per meter for every unit for sale
 * in a project, phase or building. Reserved and sold units keep their price.
 */
export default async function RepriceUnitsPage() {
  const [locale, session, projects, types] = await Promise.all([
    getLocale(),
    getSession(),
    safe(projectOptions()),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
  ]);
  if (session?.role !== 'ADMIN' && !(await can('units:update'))) redirect('/dashboard/units' as never);
  const unitsM = uiT(locale).pages.units;
  const m = unitsM.repriceForm;

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
      {projects.error && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {projects.error}
        </div>
      )}
      <PremiumSectionCard title={m.title} icon={<Calculator />}>
        <RepriceForm projects={projects.data?.data ?? []} types={(types.data ?? []).filter((t) => t.active)} locale={locale} />
      </PremiumSectionCard>
    </div>
  );
}
