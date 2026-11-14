import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import type { UnitTypeOption } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { listingsT } from '@/components/listings/messages';
import { ListingForm } from '../_components/listing-form';

export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  const locale = await getLocale();
  const m = listingsT(locale);
  const [typesRes, agentsRes] = await Promise.all([
    safe(api.get<UnitTypeOption[]>('/unit-types')),
    safe(staffOptions(['ADMIN', 'SALES_MANAGER', 'SALES'], { active: true })),
  ]);
  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.form.newTitle}
        description={m.form.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/listings' },
          { label: m.form.newTitle },
        ]}
      />
      <ListingForm locale={locale} unitTypes={typesRes.data ?? []} agents={agentsRes.data?.data ?? []} />
    </div>
  );
}
