import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  Wrench, User as UserIcon, Home, AlertCircle, UserCog, ArrowLeft,
  CheckCircle2, XCircle, ClipboardList, Star, ShieldCheck, Phone, Mail,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  MaintenancePriority, MaintenanceResolutionConfirmedBy, MaintenanceReviewStatus,
  MaintenanceStatus, MaintenanceRequestItem, Paged, User,
} from '@/lib/types';
import { formatDateTime, tx, maintenanceSlaLabel, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  MaintenanceStatusBadge, MaintenancePriorityBadge,
  MaintenanceReviewStatusBadge, WarrantyStatusBadge,
} from '@/components/badges';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

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
  complaintAt?: string | null;
  unresolvedAt?: string | null;
  customerConfirmedResolutionAt?: string | null;
  supervisorConfirmedResolutionAt?: string | null;
  resolvedBy?: MaintenanceResolutionConfirmedBy | null;
  customerRating?: number | null;
  customerRatingText?: string | null;
  customerRatingSubmittedAt?: string | null;
}

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

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';
const CONTACT_TILE = 'flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors';
const CONTACT_ICON = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5';

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
        <PremiumPageHero
          title="طلب صيانة"
          breadcrumbs={[
            { label: 'لوحة التحكم', href: '/dashboard' },
            { label: 'الصيانة', href: '/dashboard/maintenance' },
            { label: 'التفاصيل' },
          ]}
        />
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

  const heroTitle = m.category
    ? tx(m.category.name)
    : `طلب صيانة #${m.id.slice(0, 8).toUpperCase()}`;

  const resolvedByLabel =
    m.resolvedBy === 'BOTH' ? 'أكد الطرفان الحل'
    : m.resolvedBy === 'CUSTOMER' ? 'أكد العميل الحل'
    : m.resolvedBy === 'SUPERVISOR' ? 'أكد مشرف الصيانة الحل'
    : 'لم يتم التأكيد بعد';
  const resolvedByCls =
    m.resolvedBy === 'BOTH' ? 'bg-success-50 text-success-700'
    : m.resolvedBy ? 'bg-info-50 text-info-700'
    : 'bg-canvas border border-hairline text-slate-500';

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={heroTitle}
        description={`رقم الطلب: ${m.id.slice(0, 8).toUpperCase()}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصيانة', href: '/dashboard/maintenance' },
          { label: 'التفاصيل' },
        ]}
        meta={
          <>
            <MaintenanceReviewStatusBadge status={m.reviewStatus} />
            {approved && <MaintenanceStatusBadge status={m.status} />}
            {overdue && (
              <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 border border-danger-100 px-2.5 py-0.5 text-xs font-semibold">
                متأخر
              </span>
            )}
          </>
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

      <PremiumDetailLayout
        sideSticky={false}
        main={
          <div className="space-y-5">
            {/* Overview */}
            <PremiumSectionCard title="نظرة عامة" icon={<Wrench />}>
              <div className="space-y-5">
                {/* Key fields — 3 columns */}
                <div className="grid grid-cols-3 gap-x-6">
                  <Field label="التصنيف">
                    <span className="text-[14px] font-bold text-slate-900">
                      {m.category ? tx(m.category.name) : '—'}
                    </span>
                  </Field>
                  <Field label="الأولوية">
                    {m.priority
                      ? <MaintenancePriorityBadge priority={m.priority} />
                      : <span className="text-[13px] text-slate-400">—</span>}
                  </Field>
                  <Field label="الموعد المستهدف">
                    {!approved ? (
                      <span className="text-[11px] text-slate-400">
                        {pending ? 'بعد الاعتماد' : '—'}
                      </span>
                    ) : m.dueAt ? (
                      <span className={cn(
                        'text-[12px] font-semibold tabular-nums inline-flex items-center gap-1',
                        overdue ? 'text-danger-600' : 'text-slate-900',
                      )}>
                        {formatDate(m.dueAt)}
                        {overdue && (
                          <span className="rounded-full bg-danger-50 text-danger-700 text-[10px] font-semibold px-1.5 py-0.5">
                            متأخر
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[13px] text-slate-400">—</span>
                    )}
                  </Field>
                </div>

                {/* Description box */}
                <div className="rounded-xl bg-canvas/50 border border-hairline px-4 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    الوصف
                  </p>
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {m.description}
                  </p>
                </div>

                {/* SLA result — only when resolved */}
                {slaResult && (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 shrink-0">
                      نتيجة المدة المستهدفة
                    </p>
                    {slaResult === 'within' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 text-success-700 text-[11px] font-semibold px-2.5 py-0.5">
                        تم الحل ضمن المدة
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 text-[11px] font-semibold px-2.5 py-0.5">
                        تم الحل بعد الموعد
                      </span>
                    )}
                  </div>
                )}

                {/* Dates — full-width rows, no orphan grid issues */}
                <div className="rounded-xl border border-hairline overflow-hidden divide-y divide-hairline">
                  <DateRow label="تاريخ الإنشاء" value={formatDateTime(m.createdAt)} />
                  <DateRow label="آخر تحديث" value={formatDateTime(m.updatedAt)} />
                  {m.approvedAt && (
                    <DateRow label="تاريخ الاعتماد" value={formatDateTime(m.approvedAt)} valueCls="text-success-700" />
                  )}
                  {m.rejectedAt && (
                    <DateRow label="تاريخ الرفض" value={formatDateTime(m.rejectedAt)} valueCls="text-danger-700" />
                  )}
                  {m.resolvedAt && (
                    <DateRow label="تاريخ الحل" value={formatDateTime(m.resolvedAt)} valueCls="text-success-700" />
                  )}
                  {m.closedAt && (
                    <DateRow label="تاريخ الإغلاق" value={formatDateTime(m.closedAt)} />
                  )}
                </div>
              </div>
            </PremiumSectionCard>

            {/* Review */}
            <PremiumSectionCard title="المراجعة" icon={<ClipboardList />}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 shrink-0">
                    حالة المراجعة
                  </p>
                  <MaintenanceReviewStatusBadge status={m.reviewStatus} />
                </div>
                {pending && (
                  <>
                    <p className="text-[12px] text-slate-500">
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
                  <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-3 py-2.5 text-[13px]">
                    تم رفض الطلب ولا يمكن تنفيذه.
                  </div>
                )}
                {approved && (
                  <p className="text-[12px] text-slate-500">
                    تم اعتماد الطلب
                    {m.maxHandlingSlaMinutesSnapshot != null
                      && ` · مدة المعالجة المستهدفة: ${maintenanceSlaLabel(m.maxHandlingSlaMinutesSnapshot)}`}
                    .
                  </p>
                )}
              </div>
            </PremiumSectionCard>

            {/* Resolution & rating */}
            <PremiumSectionCard title="متابعة الحل والتقييم" icon={<ShieldCheck />}>
              <div className="space-y-5">
                {/* Status badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${resolvedByCls}`}>
                    {resolvedByLabel}
                  </span>
                  {overdue && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2.5 py-0.5 text-[11px] font-semibold">
                      متأخر عن SLA
                    </span>
                  )}
                  {m.complaintAt && (
                    <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2.5 py-0.5 text-[11px] font-semibold">
                      تم تقديم شكوى
                    </span>
                  )}
                  {m.unresolvedAt && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2.5 py-0.5 text-[11px] font-semibold">
                      لم تُحل
                    </span>
                  )}
                </div>

                {/* Confirmation dates */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-hairline sm:grid-cols-4">
                  <Field label="تأكيد العميل">
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      m.customerConfirmedResolutionAt ? 'text-success-700' : 'text-slate-400',
                    )}>
                      {m.customerConfirmedResolutionAt ? formatDateTime(m.customerConfirmedResolutionAt) : 'لم يؤكد بعد'}
                    </span>
                  </Field>
                  <Field label="تأكيد مشرف الصيانة">
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      m.supervisorConfirmedResolutionAt ? 'text-success-700' : 'text-slate-400',
                    )}>
                      {m.supervisorConfirmedResolutionAt ? formatDateTime(m.supervisorConfirmedResolutionAt) : 'لم يؤكد بعد'}
                    </span>
                  </Field>
                  <Field label="تاريخ الشكوى">
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      m.complaintAt ? 'text-warning-700' : 'text-slate-400',
                    )}>
                      {m.complaintAt ? formatDateTime(m.complaintAt) : '—'}
                    </span>
                  </Field>
                  <Field label="تاريخ عدم الحل">
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      m.unresolvedAt ? 'text-danger-700' : 'text-slate-400',
                    )}>
                      {m.unresolvedAt ? formatDateTime(m.unresolvedAt) : '—'}
                    </span>
                  </Field>
                </div>

                {/* Customer rating */}
                <div className="pt-4 border-t border-hairline">
                  <Field label="تقييم العميل">
                    {m.customerRating ? (
                      <div className="space-y-2 mt-0.5">
                        <Stars value={m.customerRating} />
                        {m.customerRatingText && (
                          <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{m.customerRatingText}</p>
                        )}
                        {m.customerRatingSubmittedAt && (
                          <p className="text-[11px] text-slate-400">
                            أُرسل في {formatDateTime(m.customerRatingSubmittedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-400 mt-0.5">لم يقم العميل بتقييم الخدمة بعد.</p>
                    )}
                  </Field>
                </div>
              </div>
            </PremiumSectionCard>

            {/* Items table */}
            {items.length > 0 && (
              <PremiumSectionCard title="العناصر المحددة" padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-canvas/50 border-b border-hairline">
                      <tr>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">التصنيف</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">الأولوية</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">مدة المعالجة</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">الضمان</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">نهاية الضمان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-canvas/40 transition-colors duration-100">
                          <td className="px-5 py-3 text-[13px] font-semibold text-slate-900">
                            {it.category ? tx(it.category.name) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <MaintenancePriorityBadge priority={it.categoryPrioritySnapshot} />
                          </td>
                          <td className="px-5 py-3 text-[12px] text-slate-600">
                            {maintenanceSlaLabel(it.handlingSlaMinutesSnapshot) ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            <WarrantyStatusBadge status={it.warrantyStatusSnapshot} />
                          </td>
                          <td className="px-5 py-3 text-[12px] text-slate-600 tabular-nums">
                            {it.warrantyEndSnapshot ? formatDate(it.warrantyEndSnapshot) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumSectionCard>
            )}

            {/* Workflow */}
            {approved && (
              <PremiumSectionCard title="سير العمل">
                {m.status === 'CLOSED' ? (
                  <p className="text-[13px] text-slate-500">تم إغلاق الطلب ولا توجد إجراءات متاحة.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      الإجراءات المتاحة من الحالة الحالية
                    </p>
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
              </PremiumSectionCard>
            )}
          </div>
        }
        side={
          <div className="space-y-5">
            <PremiumCommandPanel title="روابط سريعة">
              {m.customer && (
                <Link href={`/dashboard/customers/${m.customer.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><UserIcon /></span>
                  ملف العميل
                </Link>
              )}
              {m.unit && (
                <Link href={`/dashboard/units/${m.unit.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><Home /></span>
                  تفاصيل الوحدة
                </Link>
              )}
              <Link href="/dashboard/maintenance" className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                قائمة الصيانة
              </Link>
            </PremiumCommandPanel>

            {/* Customer and unit */}
            <PremiumSectionCard title="العميل والوحدة" icon={<Home />}>
              <div className="space-y-4">
                {/* Customer */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                      <UserIcon />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">العميل</p>
                      <p className="text-[13.5px] font-bold text-slate-900 truncate">
                        {m.customer?.fullName ?? '—'}
                      </p>
                    </div>
                  </div>
                  {m.customer?.phone && (
                    <a href={`tel:${m.customer.phone}`} className={CONTACT_TILE}>
                      <span className={CONTACT_ICON}><Phone /></span>
                      <span className="text-[13px] font-medium text-slate-700 flex-1 truncate" dir="ltr">
                        {m.customer.phone}
                      </span>
                    </a>
                  )}
                  {m.customer?.email && (
                    <a href={`mailto:${m.customer.email}`} className={CONTACT_TILE}>
                      <span className={CONTACT_ICON}><Mail /></span>
                      <span className="text-[13px] font-medium text-slate-700 flex-1 truncate" dir="ltr">
                        {m.customer.email}
                      </span>
                    </a>
                  )}
                </div>

                {/* Unit */}
                <div className="pt-4 border-t border-hairline space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                      <Home />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">الوحدة</p>
                      <p className="text-[16px] font-black text-brand-700 font-mono leading-none">
                        {m.unit?.code ?? '—'}
                      </p>
                    </div>
                  </div>
                  {m.unit && (
                    <p className="text-[12px] text-slate-500 ms-12">
                      {m.unit.type} · الطابق {m.unit.floor}
                    </p>
                  )}
                </div>
              </div>
            </PremiumSectionCard>

            {/* Assignment */}
            {approved && (
              <PremiumSectionCard title="الإسناد" icon={<UserCog />}>
                <div className="space-y-4">
                  {/* Current assignee */}
                  {m.assignedAdmin ? (
                    <div className="flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <UserCog />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">المسؤول الحالي</p>
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{m.assignedAdmin.fullName}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400">غير مسند بعد.</p>
                  )}

                  {m.status !== 'CLOSED' ? (
                    <form action={assignAction.bind(null, m.id)} className="space-y-2.5">
                      <Select
                        name="assignedAdminId"
                        inputSize="sm"
                        defaultValue={m.assignedAdminId ?? ''}
                        required
                      >
                        <option value="">— اختر مسؤولاً —</option>
                        {admins.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName} — {assigneeRoleLabel(a.role)}
                          </option>
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
                    <p className="text-[12px] text-slate-400">الطلب مغلق — لا يمكن تعديل الإسناد.</p>
                  )}
                </div>
              </PremiumSectionCard>
            )}

            <OwnerDocumentsCard
              ownerType="MAINTENANCE_REQUEST"
              ownerId={m.id}
              title="مستندات وصور الصيانة"
            />
          </div>
        }
      />

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
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function DateRow({
  label,
  value,
  valueCls = 'text-slate-700',
}: {
  label: string;
  value: string;
  valueCls?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span className={`text-[12px] font-medium tabular-nums shrink-0 ${valueCls}`}>{value}</span>
    </div>
  );
}
