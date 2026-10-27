export const dynamic = 'force-dynamic';

import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { PremiumPageHero } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { BrandingForm } from './_components/branding-form';
import { WebsiteDomainSummary } from './_components/website-domain-summary';
import type { DomainView } from '@/components/website-domain/domain-card';

async function fetchBranding() {
  try {
    return await api.get<Record<string, unknown>>('/company/branding');
  } catch (e) {
    unstable_rethrow(e);
    return {};
  }
}

// The company sees its website domain; the platform owner connects it.
async function fetchDomains(): Promise<DomainView[]> {
  try {
    return await api.get<DomainView[]>('/company-domains');
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}

export default async function BrandingPage() {
  const [branding, domains, locale] = await Promise.all([fetchBranding(), fetchDomains(), getLocale()]);

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title="الهوية البصرية"
        description="خصّص ألوان شركتك وشعارها ومعلومات التواصل التي تظهر في الموقع والتطبيق"
        breadcrumbs={[
          { label: 'الإدارة' },
          { label: 'الهوية البصرية' },
        ]}
      />
      <WebsiteDomainSummary domains={domains} locale={locale} />
      <BrandingForm initial={branding as Parameters<typeof BrandingForm>[0]['initial']} />
    </div>
  );
}
