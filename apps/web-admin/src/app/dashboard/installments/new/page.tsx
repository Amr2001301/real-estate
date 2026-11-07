import { safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PageHeader } from '@/components/ui/page-header';
import Link from 'next/link';
import PlanForm from '../_form';
import ProjectPlanForm from '../_project-plan-form';
import { projectPlansT } from '@/messages/project-plans';

export default async function NewInstallmentPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const unitScope = scope === 'unit';
  const [projectsRes, currency, locale] = await Promise.all([
    safe(projectOptions()),
    getReportsCurrency(),
    getLocale(),
  ]);
  const projects = projectsRes.data?.data ?? [];
  const m = uiT(locale);
  const n = m.pages.installmentsNew;
  const t = projectPlansT(locale);
  const tab = (active: boolean) =>
    `rounded-xl border px-4 py-2 text-sm transition ${active ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-hairline bg-surface text-muted hover:border-brand-300'}`;

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
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/installments/new" className={tab(!unitScope)}>{t.tabProject}</Link>
        <Link href={'/dashboard/installments/new?scope=unit' as never} className={tab(unitScope)}>{t.tabUnit}</Link>
      </div>
      {unitScope ? (
        <PlanForm projects={projects} mode="create" currency={currency} locale={locale} />
      ) : (
        <ProjectPlanForm projects={projects} mode="create" currency={currency} locale={locale} />
      )}
    </div>
  );
}
