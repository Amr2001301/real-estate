export const dynamic = 'force-dynamic';

import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { PremiumPageHero } from '@/components/premium';
import { BrandingForm } from './_components/branding-form';

async function fetchBranding() {
  try {
    return await api.get<Record<string, unknown>>('/company/branding');
  } catch (e) {
    unstable_rethrow(e);
    return {};
  }
}

export default async function BrandingPage() {
  const branding = await fetchBranding();

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
      <BrandingForm initial={branding as Parameters<typeof BrandingForm>[0]['initial']} />
    </div>
  );
}
