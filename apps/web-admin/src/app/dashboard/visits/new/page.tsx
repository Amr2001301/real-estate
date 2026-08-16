import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, User, LeadStage, Project } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import NewVisitForm from './_form';

export const dynamic = 'force-dynamic';

interface UnitOption {
  id: string;
  code: string;
  type: string;
  building?: { phase?: { project?: { id: string; name: { ar: string; en: string } } } };
}

interface LeadOption {
  id: string;
  fullName: string;
  phone: string;
  stage: LeadStage;
  projectInterest?: { id: string; name: { ar: string; en: string } } | null;
}

export default async function NewVisitPage() {
  const locale = await getLocale();
  const m = uiT(locale);
  const n = m.pages.visitsNew;

  const [meRes, projectsRes, unitsRes, leadsRes, clientsRes, customersRes, salesRes] =
    await Promise.all([
      safe(api.get<User>('/users/me')),
      safe(api.get<Paged<Project>>('/projects?pageSize=200')),
      safe(api.get<Paged<UnitOption>>('/units?pageSize=200')),
      safe(api.get<Paged<LeadOption>>('/leads?pageSize=200')),
      safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=200')),
      safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=200')),
      safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
    ]);

  const clients = [
    ...(clientsRes.data?.data ?? []),
    ...(customersRes.data?.data ?? []),
  ].map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role as 'CLIENT' | 'CUSTOMER',
  }));

  const currentRole = (meRes.data?.role ?? 'SALES') as 'ADMIN' | 'SALES';

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Premium header card ── */}
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav aria-label="breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  {m.common.breadcrumbHome}
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard/visits' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  {m.nav.items.visits}
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">{n.breadcrumb}</span>
              </li>
            </ol>
          </nav>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                {n.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                {n.description}
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              {n.badge}
            </span>
          </div>
        </div>
      </div>

      <NewVisitForm
        currentRole={currentRole}
        projects={projectsRes.data?.data ?? []}
        units={unitsRes.data?.data ?? []}
        leads={leadsRes.data?.data ?? []}
        clients={clients}
        salesOptions={salesRes.data?.data ?? []}
        locale={locale}
      />
    </div>
  );
}
