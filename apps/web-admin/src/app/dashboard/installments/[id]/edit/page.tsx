import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { InstallmentPlanTemplate } from '@/lib/types';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import PlanForm from '../../_form';

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

export default async function EditInstallmentPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [planRes, projectsRes, currency, locale] = await Promise.all([
    safe(api.get<InstallmentPlanTemplate>(`/installment-plan-templates/${id}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
    getReportsCurrency(),
    getLocale(),
  ]);

  if (planRes.error || !planRes.data) notFound();

  const plan = planRes.data;
  const projects = projectsRes.data?.data ?? [];
  const m = uiT(locale);
  const n = m.pages.installmentsEdit;

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-2">
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-navy transition-colors">{m.common.breadcrumbHome}</Link>
            <span>/</span>
            <Link href="/dashboard/installments" className="hover:text-navy transition-colors">{m.nav.items.installments}</Link>
            <span>/</span>
            <Link href={`/dashboard/installments/${id}` as never} className="hover:text-navy transition-colors">{plan.name}</Link>
            <span>/</span>
            <span className="text-navy font-medium">{n.breadcrumb}</span>
          </nav>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy">{n.title}</h1>
              <p className="text-sm text-slate-500 mt-1">{plan.name}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {n.badge}
            </span>
          </div>
        </div>
      </div>
      <PlanForm projects={projects} initialData={plan} mode="edit" currency={currency} locale={locale} />
    </div>
  );
}
