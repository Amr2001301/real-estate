import Link from 'next/link';
import { Plus, Wallet, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, InstallmentPlanTemplate } from '@/lib/types';
import { formatDate, formatCurrency, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/table';
import { PlanTemplateStatusBadge } from '@/components/badges';
import { PlanActions } from './_components/plan-actions';

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
  const isAdmin = session?.role === 'ADMIN';
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.status) qs.set('status', sp.status);

  const [statsRes, plansRes, projectsRes] = await Promise.all([
    isAdmin ? safe(api.get<Stats>('/installment-plan-templates/stats')) : Promise.resolve({ data: null, error: null }),
    safe(api.get<Paged<InstallmentPlanTemplate>>(`/installment-plan-templates?${qs}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
  ]);

  const stats = statsRes.data;
  const plans = plansRes.data?.data ?? [];
  const paginationMeta = plansRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="خطط التقسيط"
        description="تُنشئها الإدارة وتُتاح لفريق المبيعات لعرضها على العملاء."
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

      {/* KPI cards (admin only) */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="إجمالي الخطط"
            value={stats.total}
            icon={<Wallet className="h-5 w-5" />}
            tone="neutral"
          />
          <KpiCard
            label="نشطة"
            value={stats.active}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="success"
          />
          <KpiCard
            label="مسودة"
            value={stats.draft}
            icon={<FileText className="h-5 w-5" />}
            tone="warning"
          />
          <KpiCard
            label="غير نشطة"
            value={stats.inactive}
            icon={<Wallet className="h-5 w-5" />}
            tone="info"
          />
        </div>
      )}

      {/* Filters */}
      <FilterBar method="get" action="/dashboard/installments">
        <FilterField label="بحث" htmlFor="filter-q">
          <Input
            id="filter-q"
            name="q"
            defaultValue={sp.q}
            placeholder="اسم الخطة أو المشروع أو الوحدة…"
            inputSize="sm"
          />
        </FilterField>
        <FilterField label="المشروع" htmlFor="filter-project">
          <Select
            id="filter-project"
            name="projectId"
            inputSize="sm"
            defaultValue={sp.projectId ?? ''}
          >
            <option value="">الكل</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {tx(p.name)}
              </option>
            ))}
          </Select>
        </FilterField>
        {isAdmin && (
          <FilterField label="الحالة" htmlFor="filter-status">
            <Select
              id="filter-status"
              name="status"
              inputSize="sm"
              defaultValue={sp.status ?? ''}
            >
              <option value="">الكل</option>
              <option value="DRAFT">مسودة</option>
              <option value="ACTIVE">نشطة</option>
              <option value="INACTIVE">غير نشطة</option>
            </Select>
          </FilterField>
        )}
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          <Link href="/dashboard/installments">
            <Button type="button" variant="outline" size="sm">
              إعادة تعيين
            </Button>
          </Link>
        </div>
      </FilterBar>

      {/* Error */}
      {plansRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{plansRes.error}</p>
        </div>
      )}

      {/* Table */}
      <DataTable
        rowKey={(r) => r.id}
        rows={plans}
        emptyMessage="لا توجد خطط تقسيط"
        columns={[
          {
            key: 'name',
            header: 'اسم الخطة',
            cell: (r) => (
              <Link
                href={`/dashboard/installments/${r.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {r.name}
              </Link>
            ),
          },
          {
            key: 'project',
            header: 'المشروع / الوحدة',
            cell: (r) => (
              <div>
                <p>{r.project ? tx(r.project.name) : '—'}</p>
                {r.unit && <p className="text-xs text-slate-500">وحدة: {r.unit.code}</p>}
              </div>
            ),
          },
          {
            key: 'netPrice',
            header: 'صافي السعر',
            cell: (r) => (
              <span className="tabular-nums font-medium">{formatCurrency(r.netPrice)}</span>
            ),
          },
          {
            key: 'installments',
            header: 'الأقساط',
            cell: (r) => (
              <div>
                <p>{r.installmentsCount} قسط</p>
                <p className="text-xs text-slate-500">{FREQUENCY_LABELS[r.frequency] ?? r.frequency}</p>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'الحالة',
            cell: (r) => <PlanTemplateStatusBadge status={r.status} />,
          },
          {
            key: 'createdAt',
            header: 'تاريخ الإنشاء',
            cell: (r) => <span className="text-xs">{formatDate(r.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            cell: (r) => <PlanActions plan={r} isAdmin={isAdmin} />,
          },
        ]}
      />

      {/* Pagination */}
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
