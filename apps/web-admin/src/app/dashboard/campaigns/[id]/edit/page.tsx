import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import type { CampaignDetail, LeadSource } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { campaignT } from '@/components/campaigns/messages';
import { CampaignForm } from '../../_components/campaign-form';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const m = campaignT(locale);
  const [campaignRes, projectsRes, sourcesRes] = await Promise.all([
    safe(api.get<CampaignDetail>(`/campaigns/${id}`)),
    safe(projectOptions()),
    safe(api.get<LeadSource[]>('/lead-sources')),
  ]);
  if (!campaignRes.data) {
    return <div className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{campaignRes.error}</div>;
  }
  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.form.editTitle}
        description={campaignRes.data.name}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/campaigns' },
          { label: campaignRes.data.name, href: `/dashboard/campaigns/${id}` },
          { label: m.form.editTitle },
        ]}
      />
      <CampaignForm
        locale={locale}
        campaign={campaignRes.data}
        projects={projectsRes.data?.data ?? []}
        sources={(sourcesRes.data ?? []).filter((s) => s.active || s.id === campaignRes.data!.sourceId)}
      />
    </div>
  );
}
