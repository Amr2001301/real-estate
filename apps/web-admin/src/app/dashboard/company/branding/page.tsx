export const dynamic = 'force-dynamic';

import { Palette } from 'lucide-react';
import { api } from '@/lib/api';
import { PremiumPageHero } from '@/components/premium';
import { BrandingForm } from './_components/branding-form';

async function fetchBranding() {
  try {
    return await api.get<Record<string, unknown>>('/company/branding');
  } catch {
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
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
            <Palette className="h-3 w-3" />
            إعدادات المظهر
          </span>
        }
      />
      <BrandingForm initial={branding as Parameters<typeof BrandingForm>[0]['initial']} />
    </div>
  );
}
