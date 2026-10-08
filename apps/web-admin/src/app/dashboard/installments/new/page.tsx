import { safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PageHeader } from '@/components/ui/page-header';
import PlanForm from '../_form';

export default async function NewInstallmentPlanPage() {
  const [projectsRes, currency, locale] = await Promise.all([
    safe(projectOptions()),
    getReportsCurrency(),
    getLocale(),
  ]);
  const projects = projectsRes.data?.data ?? [];
  const m = uiT(locale);
  const n = m.pages.installmentsNew;

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title={n.title}
        description={n.description}
        breadcrumbs={[
          { label: m.common.breadcrumbHome, href: '/dashboard' },
          { label: m.nav.items.installments, href: '/dashboard/installments' },
          { label: n.breadcrumb },
        ]}
      />
      <PlanForm projects={projects} mode="create" currency={currency} locale={locale} />
    </div>
  );
}
