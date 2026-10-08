import { api, safe } from '@/lib/api';
import type { PortalProject } from '@/lib/types';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import { PremiumPageHero } from '@/components/premium';
import { ProjectsPanel } from '@/components/broker/projects-panel';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalProjectsPage() {
  const locale = await getLocale();
  const m = portalDashboardT(locale);
  const t = m.projects;
  const [r, currency] = await Promise.all([
    safe(api.get<PortalProject[]>('/portal/projects')),
    getReportsCurrency(),
  ]);
  const projects = r.data ?? [];
  const symbol = currencySymbol(currency);

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: t.breadcrumb },
        ]}
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {t.loadErrorFn(r.error)}
        </div>
      )}

      <ProjectsPanel projects={projects} symbol={symbol} locale={locale} />
    </div>
  );
}
