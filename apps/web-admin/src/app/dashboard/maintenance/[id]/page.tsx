import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Wrench, User as UserIcon, Home, AlertCircle, UserCog, ArrowLeft, CheckCircle2, XCircle, ClipboardList, Star, ShieldCheck } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenancePriority, MaintenanceResolutionConfirmedBy, MaintenanceReviewStatus, MaintenanceStatus, MaintenanceRequestItem, Paged, User } from '@/lib/types';
import { formatDateTime, tx, maintenanceSlaLabel, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MaintenanceStatusBadge, MaintenancePriorityBadge, MaintenanceReviewStatusBadge, WarrantyStatusBadge } from '@/components/badges';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';

export const dynamic = 'force-dynamic';

interface MaintenanceDetail {
  id: string;
  description: string;
  status: MaintenanceStatus;
  reviewStatus: MaintenanceReviewStatus;
  priority: MaintenancePriority | null;
  dueAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  maxHandlingSlaMinutesSnapshot: number | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; phone: string | null; email: string | null };
  unit?: { id: string; code: string; type: string; floor: number };
  category?: { id: string; name: { ar: string; en: string } };
  assignedAdmin?: { id: string; fullName: string } | null;
  assignedAdminId: string | null;
  items?: MaintenanceRequestItem[];
  // Phase A — resolution loop (additive; defensively defaulted to null).
  complaintAt?: string | null;
  unresolvedAt?: string | null;
  customerConfirmedResolutionAt?: string | null;
  supervisorConfirmedResolutionAt?: string | null;
  resolvedBy?: MaintenanceResolutionConfirmedBy | null;
  customerRating?: number | null;
  customerRatingText?: string | null;
  customerRatingSubmittedAt?: string | null;
}

// Mirrors the Batch 3 backend transition guard.
const NEXT_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};
const ACTION_LABEL: Record<MaintenanceStatus, string> = {
  ASSIGNED: 'تحديد كمسند',
  IN_PROGRESS: 'بدء التنفيذ',
  RESOLVED: 'تم الحل',
  CLOSED: 'إغلاق الطلب',
  OPEN: 'إعادة فتح',
};
const ACTION_VARIANT: Record<MaintenanceStatus, 'primary' | 'outline'> = {
  RESOLVED: 'primary',
  CLOSED: 'primary',
  ASSIGNED: 'outline',
  IN_PROGRESS: 'primary',
  OPEN: 'outline',
};

// Assignees may be admins or maintenance supervisors; label the role inline.
function assigneeRoleLabel(role: string): string {
  return role === 'MAINTENANCE_SUPERVISOR' ? 'مشرف الصيانة' : 'مدير النظام';
}

function back(id: string, err?: string): never {
  redirect(err ? `/dashboard/maintenance/${id}?err=${encodeURIComponent(err)}` : `/dashboard/maintenance/${id}`);
}

async function setStatusAction(id: string, next: MaintenanceStatus) {
  'use server';
  const res = await safe(api.post(`/maintenance-requests/${id}/status`, { status: next }));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

async function assignAction(id: string, formData: FormData) {
  'use server';
  const assignedAdminId = String(formData.get('assignedAdminId') ?? '');
  if (!assignedAdminId) back(id, 'يجب اختيار مسؤول.');
  const res = await safe(api.post(`/maintenance-requests/${id}/assign`, { assignedAdminId }));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

async function approveAction(id: string) {
  'use server';
  const res = await safe(api.post(`/maintenance-requests/${id}/approve`));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

async function rejectAction(id: string) {
  'use server';
  const res = await safe(api.post(`/maintenance-requests/${id}/reject`));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

export default async function MaintenanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [detailRes, adminsRes] = await Promise.all([
    safe(api.get<MaintenanceDetail>(`/maintenance-requests/${id}`)),
    safe(api.get<Paged<User>>('/users?role=ADMIN,MAINTENANCE_SUPERVISOR&pageSize=100')),
  ]);

  if (detailRes.error?.includes('404') || detailRes.error?.toLowerCase().includes('not found')) {
    notFound();
  }
  const m = detailRes.data;
  const admins = adminsRes.data?.data ?? [];

  if (!m) {
    return (
      <div className="space-y-5">
        <PageHeader title="طلب صيانة" breadcrumbs={[{ label: 'الصيانة', href: '/dashboard/maintenance' }, { label: 'التفاصيل' }]} />
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          تعذّر تحميل الطلب: {detailRes.error}
        </div>
      </div>
    );
  }

  const approved = m.reviewStatus === 'APPROVED';
  const pending = m.reviewStatus === 'PENDING';
  const rejected = m.reviewStatus === 'REJECTED';
  const transitions = NEXT_TRANSITIONS[m.status];
  const overdue = approved && !!m.dueAt && m.status !== 'CLOSED' && new Date(m.dueAt).getTime() < Date.now();
  const items = m.items ?? [];
  const slaResult: 'within' | 'after' | null =
    m.resolvedAt && m.dueAt
      ? new Date(m.resolvedAt).getTime() <= new Date(m.dueAt).getTime()
        ? 'within'
        : 'after'
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="تفاصيل طلب الصيانة"
        description={`رقم الطلب: ${m.id.slice(0, 8).toUpperCase()}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصيانة', href: '/dashboard/maintenance' },
          { label: 'التفاصيل' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <MaintenanceReviewStatusBadge status={m.reviewStatus} />
            {approved && <MaintenanceStatusBadge status={m.status} />}
          </div>
        }
      />

      {sp.err && (
        <div className="rounded-xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر تنفيذ العملية</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">نظرة عامة</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="التصنيف" value={m.category ? tx(m.category.name) : '—'} />
              <div>
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">الأولوية</p>
                {m.priority ? <MaintenancePriorityBadge priority={m.priority} /> : <p className="text-sm text-slate-700">—</p>}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1">الوصف</p>
              <p className="text-slate-700 whitespace-pre-wrap">{m.description}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-0.5">الموعد المستهدف للمعالجة</p>
              {!approved ? (
                <p className="text-xs text-slate-500">
                  {pending ? 'يبدأ احتساب مدة المعالجة بعد اعتماد الطلب.' : 'لا يوجد موعد مستهدف.'}
                </p>
              ) : m.dueAt ? (
                <p className={`text-sm inline-flex items-center gap-1.5 ${overdue ? 'text-danger-600 font-semibold' : 'text-slate-700'}`}>
                  {formatDateTime(m.dueAt)}
                  {overdue && <span className="rounded-full bg-danger-50 text-danger-700 text-[11px] px-2 py-0.5">متأخر</span>}
                </p>
              ) : (
                <p className="text-sm text-slate-700">—</p>
              )}
            </div>
            {slaResult && (
              <div>
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">نتيجة المدة المستهدفة</p>
                {slaResult === 'within' ? (
                  <span className="inline-block rounded-full bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5">تم الحل ضمن المدة</span>
                ) : (
                  <span className="inline-block rounded-full bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5">تم الحل بعد الموعد</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-hairline">
              <Field label="تاريخ الإنشاء" value={formatDateTime(m.createdAt)} />
              <Field label="آخر تحديث" value={formatDateTime(m.updatedAt)} />
              {m.approvedAt && <Field label="تاريخ الاعتماد" value={formatDateTime(m.approvedAt)} />}
              {m.rejectedAt && <Field label="تاريخ الرفض" value={formatDateTime(m.rejectedAt)} />}
              {m.resolvedAt && <Field label="تاريخ الحل" value={formatDateTime(m.resolvedAt)} />}
              {m.closedAt && <Field label="تاريخ الإغلاق" value={formatDateTime(m.closedAt)} />}
            </div>
          </CardBody>
        </Card>

        {/* Customer / unit */}
        <Card>
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">العميل والوحدة</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Field label="العميل" value={m.customer?.fullName ?? '—'} icon={<UserIcon className="h-3.5 w-3.5" />} />
            {m.customer?.phone && <Field label="الهاتف" value={m.customer.phone} ltr />}
            {m.customer?.email && <Field label="البريد" value={m.customer.email} ltr />}
            <div className="pt-2 border-t border-hairline space-y-3">
              <Field label="الوحدة" value={m.unit?.code ?? '—'} ltr />
              {m.unit && <Field label="النوع / الطابق" value={`${m.unit.type} · ${m.unit.floor}`} />}
            </div>
          </CardBody>
        </Card>

        {/* Review (approval gate) */}
        <Card className="lg:col-span-3">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">المراجعة</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">حالة المراجعة:</span>
              <MaintenanceReviewStatusBadge status={m.reviewStatus} />
            </div>
            {pending && (
              <>
                <p className="text-xs text-slate-500">
                  هذا الطلب بانتظار مراجعة المسؤول. يبدأ احتساب مدة المعالجة (الموعد المستهدف) بعد الاعتماد.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approveAction.bind(null, m.id)}>
                    <Button type="submit" variant="primary" size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                      اعتماد الطلب
                    </Button>
                  </form>
                  <form action={rejectAction.bind(null, m.id)}>
                    <Button type="submit" variant="outline" size="sm" leftIcon={<XCircle className="h-4 w-4" />}>
                      رفض الطلب
                    </Button>
                  </form>
                </div>
              </>
            )}
            {rejected && (
              <p className="rounded-lg bg-danger-50 border border-danger-100 text-danger-700 px-3 py-2 text-sm">
                تم رفض الطلب ولا يمكن تنفيذه.
              </p>
            )}
            {approved && (
              <p className="text-xs text-slate-500">
                تم اعتماد الطلب
                {m.maxHandlingSlaMinutesSnapshot != null && ` · مدة المعالجة المستهدفة: ${maintenanceSlaLabel(m.maxHandlingSlaMinutesSnapshot)}`}
                .
              </p>
            )}
          </CardBody>
        </Card>

        {/* Resolution loop (Phase A) — confirmations, rating, complaint,
            unresolved. View-only: admins never submit the customer's rating. */}
        <Card className="lg:col-span-3">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">متابعة الحل والتقييم</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            {/* State badges */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const by = m.resolvedBy ?? null;
                const label =
                  by === 'BOTH'
                    ? 'أكد الطرفان الحل'
                    : by === 'CUSTOMER'
                      ? 'أكد العميل الحل'
                      : by === 'SUPERVISOR'
                        ? 'أكد مشرف الصيانة الحل'
                        : 'لم يتم التأكيد بعد';
                const cls =
                  by === 'BOTH'
                    ? 'bg-green-100 text-green-700'
                    : by
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500';
                return (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
                    {label}
                  </span>
                );
              })()}
              {overdue && (
                <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2.5 py-0.5 text-xs font-medium">
                  متأخر عن SLA
                </span>
              )}
              {m.complaintAt && (
                <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2.5 py-0.5 text-xs font-medium">
                  تم تقديم شكوى
                </span>
              )}
              {m.unresolvedAt && (
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-medium">
                  لم تُحل
                </span>
              )}
            </div>

            {/* Confirmation + complaint timestamps */}
            <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-3 sm:grid-cols-4">
              <Field
                label="تأكيد العميل"
                value={m.customerConfirmedResolutionAt ? formatDateTime(m.customerConfirmedResolutionAt) : 'لم يؤكد بعد'}
              />
              <Field
                label="تأكيد مشرف الصيانة"
                value={m.supervisorConfirmedResolutionAt ? formatDateTime(m.supervisorConfirmedResolutionAt) : 'لم يؤكد بعد'}
              />
              <Field label="تاريخ الشكوى" value={m.complaintAt ? formatDateTime(m.complaintAt) : '—'} />
              <Field label="تاريخ عدم الحل" value={m.unresolvedAt ? formatDateTime(m.unresolvedAt) : '—'} />
            </div>

            {/* Customer rating (read-only) */}
            <div className="border-t border-hairline pt-3">
              <p className="text-[11px] font-medium text-slate-400 mb-1">تقييم العميل</p>
              {m.customerRating ? (
                <div className="space-y-1.5">
                  <Stars value={m.customerRating} />
                  {m.customerRatingText && (
                    <p className="text-slate-700 whitespace-pre-wrap">{m.customerRatingText}</p>
                  )}
                  {m.customerRatingSubmittedAt && (
                    <p className="text-[11px] text-slate-400">
                      أُرسل في {formatDateTime(m.customerRatingSubmittedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">لم يقم العميل بتقييم الخدمة بعد.</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Selected categories / items snapshot */}
        {items.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader className="px-5 py-3.5">
              <CardTitle className="text-sm">العناصر المحددة</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 text-start">
                      <th className="px-2 py-2 font-medium text-start">التصنيف</th>
                      <th className="px-2 py-2 font-medium text-start">الأولوية</th>
                      <th className="px-2 py-2 font-medium text-start">مدة المعالجة</th>
                      <th className="px-2 py-2 font-medium text-start">الضمان</th>
                      <th className="px-2 py-2 font-medium text-start">نهاية الضمان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-2 py-2.5 font-medium text-slate-800">{it.category ? tx(it.category.name) : '—'}</td>
                        <td className="px-2 py-2.5"><MaintenancePriorityBadge priority={it.categoryPrioritySnapshot} /></td>
                        <td className="px-2 py-2.5 text-slate-600">{maintenanceSlaLabel(it.handlingSlaMinutesSnapshot) ?? '—'}</td>
                        <td className="px-2 py-2.5"><WarrantyStatusBadge status={it.warrantyStatusSnapshot} /></td>
                        <td className="px-2 py-2.5 text-slate-600 tabular-nums">{it.warrantyEndSnapshot ? formatDate(it.warrantyEndSnapshot) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Assignment + workflow only after approval */}
        {approved && (
          <>
        {/* Assignment */}
        <Card className="lg:col-span-1">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">الإسناد</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="المسؤول الحالي" value={m.assignedAdmin?.fullName ?? 'غير مسند'} />
            {m.status !== 'CLOSED' ? (
              <form action={assignAction.bind(null, m.id)} className="space-y-2">
                <Select name="assignedAdminId" inputSize="sm" defaultValue={m.assignedAdminId ?? ''} required>
                  <option value="">— اختر مسؤولاً —</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.fullName} — {assigneeRoleLabel(a.role)}</option>
                  ))}
                </Select>
                {m.status === 'OPEN' && (
                  <p className="text-[11px] text-slate-400">
                    سيتم تغيير الحالة إلى «مسند» تلقائياً عند الإسناد.
                  </p>
                )}
                <Button type="submit" variant="outline" size="sm">حفظ الإسناد</Button>
              </form>
            ) : (
              <p className="text-xs text-slate-400">الطلب مغلق — لا يمكن تعديل الإسناد.</p>
            )}
          </CardBody>
        </Card>

        {/* Status workflow */}
        <Card className="lg:col-span-2">
          <CardHeader className="px-5 py-3.5">
            <CardTitle className="text-sm">سير العمل</CardTitle>
          </CardHeader>
          <CardBody>
            {m.status === 'CLOSED' ? (
              <p className="text-sm text-slate-500">تم إغلاق الطلب ولا توجد إجراءات متاحة.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">الإجراءات المتاحة من الحالة الحالية:</p>
                <div className="flex flex-wrap items-center gap-2">
                  {transitions.map((next) => (
                    <form key={next} action={setStatusAction.bind(null, m.id, next)}>
                      <Button type="submit" variant={ACTION_VARIANT[next]} size="sm">
                        {ACTION_LABEL[next]}
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
          </>
        )}
      </div>

      {/* Attachments — reuses the shared documents infrastructure. */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-400 px-1">
          يمكن إرفاق صور قبل وبعد الصيانة أو فواتير الإصلاح.
        </p>
        <OwnerDocumentsCard
          ownerType="MAINTENANCE_REQUEST"
          ownerId={m.id}
          title="مستندات وصور الصيانة"
        />
      </div>

      <Link
        href="/dashboard/maintenance"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        العودة إلى قائمة الصيانة
      </Link>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        />
      ))}
      <span className="ms-1 text-xs text-slate-500 tabular-nums">{value}/5</span>
    </span>
  );
}

function Field({
  label, value, ltr, icon,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 inline-flex items-center gap-1.5" dir={ltr ? 'ltr' : undefined}>
        {icon && <span className="text-slate-400">{icon}</span>}
        {value}
      </p>
    </div>
  );
}
