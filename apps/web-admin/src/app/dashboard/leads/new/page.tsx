import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Project, LeadSource, User, Unit } from '@/lib/types';
import LeadForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const sp = await searchParams;

  const [projectsRes, sourcesRes, salesRes, clientRes, unitsRes] = await Promise.all([
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
    safe(api.get<LeadSource[]>('/lead-sources')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
    sp.clientId
      ? safe(api.get<User>(`/users/${sp.clientId}`))
      : Promise.resolve({ data: null, error: null } as { data: User | null; error: null }),
    safe(api.get<Paged<Unit>>('/units?pageSize=500')),
  ]);

  // Slim unit shape for form: only what the picker needs
  const unitOptions = (unitsRes.data?.data ?? []).map((u) => ({
    id: u.id,
    code: u.code,
    type: u.type,
    projectId: (u.building as { phase?: { project?: { id?: string } } } | undefined)
      ?.phase?.project?.id ?? '',
  }));

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
                  لوحة التحكم
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard/leads' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  فرص المبيعات (CRM)
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">فرصة جديدة</span>
              </li>
            </ol>
          </nav>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                إضافة فرصة CRM جديدة
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                سجّل فرصة بيع جديدة مرتبطة بعميل قائم أو جديد، وأسندها إلى مندوب لمتابعتها في خط الأنابيب.
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              جديد
            </span>
          </div>
        </div>
      </div>

      <LeadForm
        projects={projectsRes.data?.data ?? []}
        sources={sourcesRes.data ?? []}
        sales={salesRes.data?.data ?? []}
        initialClient={clientRes.data ?? null}
        units={unitOptions}
      />
    </div>
  );
}
