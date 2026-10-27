import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import type { LeadSource } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { campaignT } from '@/components/campaigns/messages';
import { CampaignForm } from '../_components/campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const locale = await getLocale();
  const m = campaignT(locale);
  const [projectsRes, sourcesRes] = await Promise.all([safe(projectOptions()), safe(api.get<LeadSource[]>('/lead-sources'))]);
  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.form.newTitle}
        description={m.form.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/campaigns' },
          { label: m.form.newTitle },
        ]}
      />
      <CampaignForm
        locale={locale}
        projects={projectsRes.data?.data ?? []}
        sources={(sourcesRes.data ?? []).filter((s) => s.active)}
      />
    </div>
  );
}
