import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Wrench, Plus, ArrowLeft, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, MaintenanceRequest, MaintenanceCategory, MaintenanceStatus, MaintenanceReviewStatus, User } from '@/lib/types';
import { formatDate, tx, maintenanceSlaLabel, warrantyMonthsLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES: MaintenanceReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const REVIEW_LABEL: Record<MaintenanceReviewStatus, string> = {
  PENDING: 'قيد المراجعة', APPROVED: 'معتمد', REJECTED: 'مرفوض',
};

const STATUSES: MaintenanceStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OPEN: 'مفتوح',
  ASSIGNED: 'مسند',
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
  // The list table and the report share the same filters.
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
  // Forward only the truthy filters to the CSV export.
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
      <form method="get" action="/dashboard/maintenance">
        <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-hairline shadow-xs px-4 py-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-[11px] font-medium text-slate-400">من تاريخ</label>
            <Input id="from" name="from" type="date" inputSize="sm" defaultValue={sp.from ?? ''} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-[11px] font-medium text-slate-400">إلى تاريخ</label>
            <Input id="to" name="to" type="date" inputSize="sm" defaultValue={sp.to ?? ''} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="categoryId" className="text-[11px] font-medium text-slate-400">التصنيف</label>
            <Select id="categoryId" name="categoryId" inputSize="sm" defaultValue={sp.categoryId ?? ''} className="w-44">
              <option value="">كل التصنيفات</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{tx(c.name)}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-[11px] font-medium text-slate-400">الحالة التشغيلية</label>
            <Select id="status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40">
              <option value="">كل الحالات</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reviewStatus" className="text-[11px] font-medium text-slate-400">حالة المراجعة</label>
            <Select id="reviewStatus" name="reviewStatus" inputSize="sm" defaultValue={sp.reviewStatus ?? ''} className="w-40">
              <option value="">كل المراجعات</option>
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>{REVIEW_LABEL[s]}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="assignedAdminId" className="text-[11px] font-medium text-slate-400">المسؤول</label>
            <Select id="assignedAdminId" name="assignedAdminId" inputSize="sm" defaultValue={sp.assignedAdminId ?? ''} className="w-48">
              <option value="">كل المسؤولين</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.fullName}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilters && (
              <Link href="/dashboard/maintenance">
                <Button type="button" variant="secondary" size="sm">مسح الفلاتر</Button>
              </Link>
            )}
          </div>
        </div>
      </form>

      {/* Operational report (KPIs + panels) — respects the same filters. */}
      <MaintenanceReports filters={reportFilters} />

      {reqsRes.error && (
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل طلبات الصيانة: {reqsRes.error}</p>
        </div>
      )}

      {/* Requests table */}
      <Card className="overflow-hidden">
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">طلبات الصيانة</CardTitle>
          {reqsRes.data && (
            <span className="text-xs text-slate-400 tabular-nums">
              {reqsRes.data.meta.total.toLocaleString('ar-EG')} طلب
            </span>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Wrench className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد طلبات صيانة تطابق الفلاتر المختارة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1020px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium">العميل</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الوحدة</th>
                    <th className="px-4 py-2.5 text-right font-medium">التصنيف</th>
                    <th className="px-4 py-2.5 text-right font-medium">الوصف</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الأولوية</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المراجعة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الموعد المستهدف</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">التاريخ</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{m.customer?.fullName ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">{m.unit?.code ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{m.category ? tx(m.category.name) : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">{m.description}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {m.priority ? <MaintenancePriorityBadge priority={m.priority} /> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><MaintenanceReviewStatusBadge status={m.reviewStatus} /></td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><MaintenanceStatusBadge status={m.status} /></td>
                      <td className="px-4 py-2.5 text-xs tabular-nums whitespace-nowrap">
                        {isApproved(m) && m.dueAt ? (
                          <span className={isOverdue(m) ? 'text-danger-600 font-semibold' : 'text-slate-500'}>
                            {formatDate(m.dueAt)}{isOverdue(m) ? ' · متأخر' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatDate(m.createdAt)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Link
                          href={`/dashboard/maintenance/${m.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                        >
                          التفاصيل
                          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Category management */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">تصنيفات الصيانة</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {sp.catErr && (
            <div className="rounded-lg bg-warning-50 border border-warning-100 text-warning-700 px-3 py-2 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>تعذّر إضافة التصنيف: {sp.catErr}</p>
            </div>
          )}
          <ul className="flex flex-wrap gap-2">
            {cats.map((c) => {
              const sla = maintenanceSlaLabel(c.slaDurationMinutes);
              const warranty = warrantyMonthsLabel(c.warrantyDurationMonths);
              return (
                <li key={c.id} className="bg-surface-muted/60 ring-1 ring-inset ring-hairline rounded-full px-3 py-1 text-xs text-slate-700 inline-flex items-center gap-1.5">
                  <span className="font-medium">{tx(c.name)}</span>
                  <span className="text-slate-400">· {PRIORITY_LABEL[c.priority] ?? c.priority}</span>
                  {sla && <span className="text-slate-400">· معالجة خلال {sla}</span>}
                  {warranty && <span className="text-slate-400">· ضمان {warranty}</span>}
                </li>
              );
            })}
            {cats.length === 0 && <li className="text-xs text-slate-400">لا توجد تصنيفات</li>}
          </ul>
          <form action={createCategoryAction} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input name="ar" required dir="rtl" placeholder="بالعربية" inputSize="sm" className="w-36" />
              <Input name="en" required dir="ltr" placeholder="English" inputSize="sm" className="w-36" />
              <Select name="priority" inputSize="sm" defaultValue="MEDIUM" className="w-32" aria-label="الأولوية">
                <option value="LOW">منخفضة</option>
                <option value="MEDIUM">متوسطة</option>
                <option value="HIGH">عالية</option>
                <option value="URGENT">عاجلة</option>
              </Select>
              <Input name="slaValue" type="number" min={1} placeholder="مدة المعالجة" inputSize="sm" className="w-28" />
              <Select name="slaUnit" inputSize="sm" defaultValue="HOURS" className="w-24" aria-label="وحدة مدة المعالجة">
                <option value="HOURS">ساعات</option>
                <option value="DAYS">أيام</option>
              </Select>
              <Input name="warrantyValue" type="number" min={1} placeholder="مدة الضمان" inputSize="sm" className="w-28" />
              <Select name="warrantyUnit" inputSize="sm" defaultValue="MONTHS" className="w-24" aria-label="وحدة مدة الضمان">
                <option value="MONTHS">شهور</option>
                <option value="YEARS">سنوات</option>
              </Select>
              <Button type="submit" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                إضافة تصنيف
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              مدة المعالجة تحدد الموعد المستهدف بعد اعتماد الطلب، ومدة الضمان تُحتسب تلقائياً للوحدة عند توقيع عقد البيع. اترك أي حقل فارغاً إن لم يكن مطلوباً.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
