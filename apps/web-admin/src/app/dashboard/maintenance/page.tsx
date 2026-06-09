import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Wrench, Plus, AlertCircle, Eye, Settings2, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import type { Paged, MaintenanceRequest, MaintenanceCategory, MaintenanceStatus, MaintenanceReviewStatus, User } from '@/lib/types';
import { formatDate, tx, maintenanceSlaLabel, warrantyMonthsLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { MaintenanceStatusBadge, MaintenancePriorityBadge, MaintenanceReviewStatusBadge } from '@/components/badges';
import { ExportMenu } from '@/components/export-menu';
import { MaintenanceReports } from './maintenance-reports';

// dueAt/overdue only apply once a request is approved (the SLA timer starts then).
function isApproved(r: MaintenanceRequest): boolean {
  return r.reviewStatus === 'APPROVED';
}
function isOverdue(r: MaintenanceRequest): boolean {
  return isApproved(r) && !!r.dueAt && r.status !== 'CLOSED' && new Date(r.dueAt).getTime() < Date.now();
}

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية', URGENT: 'عاجلة',
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-info-400',
  HIGH: 'bg-warning-500',
  URGENT: 'bg-danger-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-info-50 text-info-700',
  HIGH: 'bg-warning-50 text-warning-700',
  URGENT: 'bg-danger-50 text-danger-700',
};

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES: MaintenanceReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const REVIEW_LABEL: Record<MaintenanceReviewStatus, string> = {
  PENDING: 'قيد المراجعة', APPROVED: 'معتمد', REJECTED: 'مرفوض',
};

const STATUSES: MaintenanceStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OPEN: 'مفتوح',
  ASSIGNED: 'مُسند',
  IN_PROGRESS: 'قيد التنفيذ',
  RESOLVED: 'تم الحل',
  CLOSED: 'مغلق',
};

async function createCategoryAction(formData: FormData) {
  'use server';
  const slaRaw = String(formData.get('slaValue') ?? '').trim();
  const slaValue = slaRaw ? Number(slaRaw) : undefined;
  const warrantyRaw = String(formData.get('warrantyValue') ?? '').trim();
  const warrantyValue = warrantyRaw ? Number(warrantyRaw) : undefined;
  const res = await safe(
    api.post('/maintenance-categories', {
      ar: String(formData.get('ar') ?? ''),
      en: String(formData.get('en') ?? ''),
      priority: String(formData.get('priority') ?? 'MEDIUM'),
      ...(slaValue ? { slaValue, slaUnit: String(formData.get('slaUnit') ?? 'HOURS') } : {}),
      ...(warrantyValue
        ? { warrantyValue, warrantyUnit: String(formData.get('warrantyUnit') ?? 'MONTHS') }
        : {}),
    }),
  );
  if (res.error) {
    redirect(`/dashboard/maintenance?catErr=${encodeURIComponent(res.error)}`);
  }
  revalidatePath('/dashboard/maintenance');
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedAdminId?: string; reviewStatus?: string; categoryId?: string; from?: string; to?: string; catErr?: string }>;
}) {
  const sp = await searchParams;
  const listQs = new URLSearchParams({ pageSize: '100' });
  if (sp.status) listQs.set('status', sp.status);
  if (sp.assignedAdminId) listQs.set('assignedAdminId', sp.assignedAdminId);
  if (sp.reviewStatus) listQs.set('reviewStatus', sp.reviewStatus);
  if (sp.categoryId) listQs.set('categoryId', sp.categoryId);
  if (sp.from) listQs.set('from', sp.from);
  if (sp.to) listQs.set('to', sp.to);

  const [reqsRes, catsRes, adminsRes] = await Promise.all([
    safe(api.get<Paged<MaintenanceRequest>>(`/maintenance-requests?${listQs}`)),
    safe(api.get<MaintenanceCategory[]>('/maintenance-categories')),
    safe(api.get<Paged<User>>('/users?role=ADMIN&pageSize=100')),
  ]);

  const rows = reqsRes.data?.data ?? [];
  const admins = adminsRes.data?.data ?? [];
  const cats = catsRes.data ?? [];
  const hasFilters = !!(sp.status || sp.assignedAdminId || sp.reviewStatus || sp.categoryId || sp.from || sp.to);
  const reportFilters = {
    status: sp.status,
    reviewStatus: sp.reviewStatus,
    assignedAdminId: sp.assignedAdminId,
    categoryId: sp.categoryId,
    from: sp.from,
    to: sp.to,
  };
  const csvParams: Record<string, string | undefined> = {
    status: sp.status,
    reviewStatus: sp.reviewStatus,
    assignedAdminId: sp.assignedAdminId,
    categoryId: sp.categoryId,
    from: sp.from,
    to: sp.to,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصيانة"
        description="إدارة طلبات الصيانة: الإسناد، متابعة الحالة، وإنشاء طلب نيابة عن العميل."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصيانة' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              xlsxPath="/maintenance-requests/reports/summary.xlsx"
              csvPath="/maintenance-requests/reports/summary.csv"
              filenameBase="maintenance-report"
              params={csvParams}
            />
            <Link href="/dashboard/maintenance/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                طلب صيانة جديد
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <FilterBar
        method="get"
        action="/dashboard/maintenance"
        trailing={
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilters && (
              <Link href="/dashboard/maintenance">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </div>
        }
      >
        <FilterField label="الحالة" htmlFor="maint-status">
          <Select id="maint-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36">
            <option value="">كل الحالات</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="المراجعة" htmlFor="maint-review">
          <Select id="maint-review" name="reviewStatus" inputSize="sm" defaultValue={sp.reviewStatus ?? ''} className="w-36">
            <option value="">كل المراجعات</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{REVIEW_LABEL[s]}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="التصنيف" htmlFor="maint-category">
          <Select id="maint-category" name="categoryId" inputSize="sm" defaultValue={sp.categoryId ?? ''} className="w-44">
            <option value="">كل التصنيفات</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{tx(c.name)}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="المشرف" htmlFor="maint-admin">
          <Select id="maint-admin" name="assignedAdminId" inputSize="sm" defaultValue={sp.assignedAdminId ?? ''} className="w-36">
            <option value="">كل المشرفين</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.fullName}</option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {/* KPI + analytics */}
      <MaintenanceReports filters={reportFilters} />

      {reqsRes.error && (
        <div className="flex items-start gap-2 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل طلبات الصيانة: {reqsRes.error}</p>
        </div>
      )}

      {/* Requests table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>طلبات الصيانة</CardTitle>
          {reqsRes.data && (
            <span className="text-xs text-slate-400 tabular-nums">
              {reqsRes.data.meta.total.toLocaleString('ar-EG')} طلب
            </span>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Wrench />}
              title="لا توجد طلبات صيانة"
              description={hasFilters ? 'لا توجد طلبات تطابق الفلاتر المختارة' : 'لم يتم تسجيل أي طلبات صيانة بعد'}
              action={
                hasFilters ? (
                  <Link href="/dashboard/maintenance">
                    <Button variant="outline" size="sm">مسح الفلاتر</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1020px]">
                <thead className="bg-surface-muted/50 text-xs font-semibold text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-5 py-3 text-start whitespace-nowrap">العميل</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الوحدة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">التصنيف</th>
                    <th className="px-5 py-3 text-start">الوصف</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الأولوية</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المراجعة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الحالة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الموعد المستهدف</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">التاريخ</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => {
                    const overdue = isOverdue(m);
                    return (
                      <tr
                        key={m.id}
                        className={cn(
                          'group border-t border-hairline transition-colors',
                          overdue ? 'bg-danger-50/20' : 'hover:bg-brand-50/20',
                        )}
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {m.customer?.fullName ?? '—'}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {m.unit?.code ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                          {m.category ? tx(m.category.name) : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-600 max-w-[200px] truncate" title={m.description}>
                          {m.description}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {m.priority
                            ? <MaintenancePriorityBadge priority={m.priority} />
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <MaintenanceReviewStatusBadge status={m.reviewStatus} />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1">
                            <MaintenanceStatusBadge status={m.status} />
                            {m.unresolvedAt ? (
                              <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2 py-0.5 text-[10px] font-medium">
                                لم تُحل
                              </span>
                            ) : m.complaintAt ? (
                              <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2 py-0.5 text-[10px] font-medium">
                                شكوى
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums whitespace-nowrap">
                          {isApproved(m) && m.dueAt ? (
                            <span className={overdue ? 'text-danger-600 font-semibold' : 'text-slate-500'}>
                              {formatDate(m.dueAt)}{overdue ? ' · متأخر' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {formatDate(m.createdAt)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <Link href={`/dashboard/maintenance/${m.id}`}>
                            <IconButton label="عرض تفاصيل الطلب" variant="outline" size="sm">
                              <Eye />
                            </IconButton>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Category management */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle>تصنيفات الصيانة</CardTitle>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">{cats.length} تصنيف</span>
        </CardHeader>

        {/* Premium category cards */}
        {cats.length > 0 && (
          <div className="px-5 pt-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cats.map((c) => {
              const sla = maintenanceSlaLabel(c.slaDurationMinutes);
              const warranty = warrantyMonthsLabel(c.warrantyDurationMonths);
              return (
                <div
                  key={c.id}
                  className="group flex overflow-hidden rounded-xl border border-hairline bg-white shadow-xs hover:shadow-soft transition-all duration-150"
                >
                  {/* Priority color bar — RTL start side (appears on right in Arabic) */}
                  <div className={cn('w-1 shrink-0', PRIORITY_DOT[c.priority] ?? 'bg-slate-400')} />
                  {/* Card body */}
                  <div className="flex-1 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 leading-tight">{tx(c.name)}</p>
                        {c.name.en && (
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{c.name.en}</p>
                        )}
                      </div>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0',
                        PRIORITY_BADGE[c.priority] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {PRIORITY_LABEL[c.priority] ?? c.priority}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {sla ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>معالجة خلال {sla}</span>
                        </div>
                      ) : null}
                      {warranty ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Shield className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>ضمان {warranty}</span>
                        </div>
                      ) : null}
                      {!sla && !warranty && (
                        <p className="text-[11px] text-slate-300">بدون مدد محددة</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add category form */}
        <div className="border-t border-hairline bg-surface-muted/40 px-5 py-4">
          {sp.catErr && (
            <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 px-3 py-2 text-xs mb-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>تعذّر إضافة التصنيف: {sp.catErr}</p>
            </div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <Plus className="h-3 w-3 text-brand-700" />
            </div>
            <p className="text-xs font-semibold text-slate-700">إضافة تصنيف جديد</p>
          </div>
          <form action={createCategoryAction}>
            <div className="flex flex-wrap items-center gap-2">
              <Input name="ar" required dir="rtl" placeholder="بالعربية" inputSize="sm" className="w-32" />
              <Input name="en" required dir="ltr" placeholder="English" inputSize="sm" className="w-32" />
              <Select name="priority" inputSize="sm" defaultValue="MEDIUM" className="w-28" aria-label="الأولوية">
                <option value="LOW">منخفضة</option>
                <option value="MEDIUM">متوسطة</option>
                <option value="HIGH">عالية</option>
                <option value="URGENT">عاجلة</option>
              </Select>
              <span className="w-px h-5 bg-hairline shrink-0" aria-hidden />
              <Input name="slaValue" type="number" min={1} placeholder="مدة المعالجة" inputSize="sm" className="w-28" />
              <Select name="slaUnit" inputSize="sm" defaultValue="HOURS" className="w-20" aria-label="وحدة مدة المعالجة">
                <option value="HOURS">ساعات</option>
                <option value="DAYS">أيام</option>
              </Select>
              <Input name="warrantyValue" type="number" min={1} placeholder="مدة الضمان" inputSize="sm" className="w-28" />
              <Select name="warrantyUnit" inputSize="sm" defaultValue="MONTHS" className="w-20" aria-label="وحدة مدة الضمان">
                <option value="MONTHS">شهور</option>
                <option value="YEARS">سنوات</option>
              </Select>
              <Button type="submit" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                إضافة
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              مدة المعالجة تحدد الموعد المستهدف بعد اعتماد الطلب. مدة الضمان تُحتسب تلقائياً للوحدة عند توقيع عقد البيع.
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}
