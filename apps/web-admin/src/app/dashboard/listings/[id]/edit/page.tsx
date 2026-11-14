import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import type { UnitTypeOption } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { listingsT, type Listing } from '@/components/listings/messages';
import { ListingForm } from '../../_components/listing-form';

export const dynamic = 'force-dynamic';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const m = listingsT(locale);
  const [listingRes, typesRes, agentsRes] = await Promise.all([
    safe(api.get<Listing>(`/listings/${id}`)),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
    safe(staffOptions(['ADMIN', 'SALES_MANAGER', 'SALES'], { active: true })),
  ]);
  const listing = listingRes.data;
  if (!listing) notFound();
  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={listing.code}
        title={m.form.editTitle}
        description={listing.title}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/listings' },
          { label: listing.code, href: `/dashboard/listings/${listing.id}` },
          { label: m.form.editTitle },
        ]}
      />
      <ListingForm locale={locale} listing={listing} unitTypes={typesRes.data ?? []} agents={agentsRes.data?.data ?? []} />
    </div>
  );
}
