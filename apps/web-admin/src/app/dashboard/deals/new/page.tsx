import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import type { Paged } from '@/lib/types';
import { getReportsCurrency, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import type { Listing, ListingTerms } from '@/components/listings/messages';
import { dealsT, type CommissionRule } from '@/components/deals/messages';
import { DealForm } from '../_components/deal-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-3 — record a closed deal; from a listing's page the listing comes picked. */
export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ listingId?: string }> }) {
  const [sp, locale, session, currency, timeZone] = await Promise.all([searchParams, getLocale(), getSession(), getReportsCurrency(), getCompanyTimeZone()]);
  const m = dealsT(locale);
  const canPickAgent = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const [listingsRes, rulesRes, agentsRes, termsRes] = await Promise.all([
    safe(api.get<Paged<Listing>>('/listings?status=AVAILABLE,UNDER_OFFER,CLOSED&pageSize=200')),
    safe(api.get<CommissionRule[]>('/deals/rules')),
    canPickAgent ? safe(staffOptions(['SALES_MANAGER', 'SALES'], { active: true })) : Promise.resolve(null),
    sp.listingId ? safe(api.get<ListingTerms>(`/listings/${sp.listingId}/terms`)) : Promise.resolve(null),
  ]);
  const listings = listingsRes.data?.data ?? [];
  const mandate = termsRes?.data?.mandates.find((x) => x.state === 'ACTIVE');
  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.form.title}
        description={m.form.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/deals' },
          { label: m.form.title },
        ]}
      />
      <DealForm
        locale={locale}
        currency={currency}
        today={todayIn(timeZone)}
        listings={listings}
        rules={rulesRes.data ?? []}
        agents={agentsRes?.data?.data ?? null}
        selfName={session?.fullName ?? ''}
        initialListingId={listings.some((l) => l.id === sp.listingId) ? sp.listingId! : ''}
        mandatePct={mandate?.commissionPct ? Number(mandate.commissionPct) : null}
      />
    </div>
  );
}
