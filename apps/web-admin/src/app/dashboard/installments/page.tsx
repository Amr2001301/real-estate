import Link from 'next/link';
import { Plus, Wallet, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, InstallmentPlanTemplate } from '@/lib/types';
import { formatDate, formatCurrency, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { PlanTemplateStatusBadge } from '@/components/badges';
import { PlanActions } from './_components/plan-actions';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

interface Stats {
  total: number;
  active: number;
  draft: number;
  inactive: number;
}

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  SEMI_ANNUAL: 'نصف سنوي',
  YEARLY: 'سنوي',
};

export default async function InstallmentPlansPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    projectId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const [sp, session] = await Promise.all([searchParams, getSession()]);
  const currency = await getReportsCurrency();
  const isAdmin = session?.role === 'ADMIN';
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.status) qs.set('status', sp.status);

  const [statsRes, plansRes, projectsRes] = await Promise.all([
    isAdmin
      ? safe(api.get<Stats>('/installment-plan-templates/stats'))
      : Promise.resolve({ data: null, error: null }),
    safe(api.get<Paged<InstallmentPlanTemplate>>(`/installment-plan-templates?${qs}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
  ]);

  const stats = statsRes.data;
  const plans = plansRes.data?.data ?? [];
  const paginationMeta = plansRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title="خطط التقسيط"
        description="متابعة خطط السداد والأقساط المرتبطة بالعقود والعملاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'خطط التقسيط' },
        ]}
        actions={
          isAdmin ? (
            <Link href="/dashboard/installments/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إنشاء خطة تقسيط
              </Button>
            </Link>
          ) : undefined
        }
      />

      {isAdmin && stats && (
        <PremiumMetricStrip
          variant="compact"
          metrics={[
            {
              label: 'إجمالي الخطط',
              value: stats.total,
              icon: <Wallet className="h-4 w-4" />,
              primary: true,
              tone: 'brand',
            },
            {
              label: 'نشطة',
              value: stats.active,
              icon: <CheckCircle2 className="h-4 w-4" />,
              tone: 'success',
            },
            {
              label: 'مسودة',
              value: stats.draft,
              icon: <FileText className="h-4 w-4" />,
              tone: 'warning',
            },
            {
              label: 'غير نشطة',
              value: stats.inactive,
              icon: <Wallet className="h-4 w-4" />,
              tone: 'neutral',
            },
          ]}
        />
      )}

      <PremiumFilterBar
        method="get"
        action="/dashboard/installments"
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {(sp.q || sp.projectId || sp.status) && (
              <Link href="/dashboard/installments">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label="بحث">
          <Input
            name="q"
            inputSize="sm"
            defaultValue={sp.q ?? ''}
            placeholder="اسم الخطة أو المشروع أو الوحدة…"
            className="min-w-[180px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label="المشروع">
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40">
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>
        {isAdmin && (
          <PremiumFilterField label="الحالة">
            <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36">
              <option value="">كل الحالات</option>
              <option value="DRAFT">مسودة</option>
              <option value="ACTIVE">نشطة</option>
              <option value="INACTIVE">غير نشطة</option>
            </Select>
          </PremiumFilterField>
        )}
      </PremiumFilterBar>

      {plansRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{plansRes.error}</p>
        </div>
      )}

      <PremiumSectionCard
        title="خطط التقسيط"
        trailing={
          paginationMeta ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {paginationMeta.total.toLocaleString('ar-EG')} خطة
            </span>
          ) : undefined
        }
        padded={false}
      >
        {plans.length === 0 ? (
          <PremiumEmptyState
            icon={<Wallet />}
            title="لا توجد خطط تقسيط"
            description="ابدأ بإنشاء أول خطة تقسيط من الزر أعلى الصفحة."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4">اسم الخطة</th>
                  <th className="text-start py-3 px-4">المشروع / الوحدة</th>
                  <th className="text-start py-3 px-4">صافي السعر</th>
                  <th className="text-start py-3 px-4">الأقساط</th>
                  <th className="text-start py-3 px-4">الحالة</th>
                  <th className="text-start py-3 px-4">تاريخ الإنشاء</th>
                  <th className="py-3 ps-4 pe-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {plans.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/40 transition-colors duration-100 align-middle">
                    <td className="py-3 ps-5 pe-4">
                      <Link
                        href={`/dashboard/installments/${r.id}`}
                        className="font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-slate-800">{r.project ? tx(r.project.name) : '—'}</p>
                        {r.unit && <p className="text-xs text-slate-500">وحدة: {r.unit.code}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums font-medium text-slate-800">
                      {formatCurrency(r.netPrice, currency)}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const optionsCount = r.durationOptions?.length ?? 0;
                        if (optionsCount > 0) {
                          return (
                            <div>
                              <p className="text-slate-800">{optionsCount} خيار مدة</p>
                              <p className="text-xs text-slate-500">
                                {r.durationOptions!.map((o) => `${o.durationMonths}ش`).join(' / ')}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <p className="text-slate-800">
                              {r.installmentsCount != null ? `${r.installmentsCount} قسط` : '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                            </p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <PlanTemplateStatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="py-3 ps-4 pe-5 text-end">
                      <PlanActions plan={r} isAdmin={isAdmin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {paginationMeta && paginationMeta.totalPages > 1 && (
        <Pagination
          page={paginationMeta.page}
          pageSize={paginationMeta.pageSize}
          total={paginationMeta.total}
          basePath="/dashboard/installments"
          params={sp}
        />
      )}
    </div>
  );
}
