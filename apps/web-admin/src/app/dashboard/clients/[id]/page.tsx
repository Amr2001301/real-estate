import Link from 'next/link';
import {
  Pencil,
  Phone,
  Mail,
  Languages,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Activity,
  ArrowLeft,
  Hash,
  Power,
  PowerOff,
  Briefcase,
  Plus,
  UserCog,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { User, Lead, Paged } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmButton } from '@/components/confirm-button';
import { LeadStageBadge } from '@/components/badges';
import { cn } from '@/lib/cn';
import { activateClientAction, deactivateClientAction } from '../actions';

interface AuditLog {
  id: string;
  actorId: string | null;
  actor?: { id: string; fullName: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditPaged {
  data: AuditLog[];
  meta: { page: number; pageSize: number; total: number };
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return parts[0]![0]! + parts[parts.length - 1]![0]!;
}

const ACTION_LABEL: Record<string, string> = {
  POST: 'إنشاء',
  PATCH: 'تحديث',
  PUT: 'تحديث',
  DELETE: 'حذف',
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [userRes, auditRes, leadsRes] = await Promise.all([
    safe(api.get<User>(`/users/${id}`)),
    safe(api.get<AuditPaged>(`/audit-logs?entityId=${id}&pageSize=6`)),
    safe(api.get<Paged<Lead>>(`/leads?clientId=${id}&pageSize=20`)),
  ]);

  if (userRes.error || !userRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل العميل: {userRes.error ?? 'غير موجود'}
      </div>
    );
  }

  const u = userRes.data;
  const role = (u.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT') as
    | 'CLIENT'
    | 'CUSTOMER';
  const recentActivity = auditRes.data?.data ?? [];
  const leads = leadsRes.data?.data ?? [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={u.fullName}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء', href: `/dashboard/clients?role=${role}` },
          { label: u.fullName },
        ]}
        meta={
          <>
            <Badge tone={role === 'CUSTOMER' ? 'success' : 'info'} variant="soft">
              {role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
            </Badge>
            <Badge
              tone={u.active ? 'success' : 'gray'}
              variant="soft"
              dot
            >
              {u.active ? 'نشط' : 'موقوف'}
            </Badge>
            <span className="text-2xs font-mono text-slate-400">
              ID: #{u.id.slice(0, 8).toUpperCase()}
            </span>
          </>
        }
        actions={
          <>
            {u.phone && (
              <a href={`tel:${u.phone}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  leftIcon={<Phone className="h-4 w-4" />}
                >
                  اتصال
                </Button>
              </a>
            )}
            <Link href={`/dashboard/clients/${id}/edit` as never}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Pencil className="h-4 w-4" />}
              >
                تعديل الملف
              </Button>
            </Link>
          </>
        }
      />

      {/* Profile hero */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 p-5 sm:p-6">
          <span
            className={cn(
              'inline-flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold ring-2 ring-white shadow-sm uppercase tabular-nums',
              paletteFor(u.fullName ?? u.id),
            )}
            aria-hidden
          >
            {initials(u.fullName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight truncate">
                {u.fullName}
              </h2>
              <Badge tone={role === 'CUSTOMER' ? 'success' : 'info'} variant="soft" size="sm">
                {role === 'CUSTOMER' ? 'مالك حالي' : 'عميل متصفّح'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {role === 'CUSTOMER'
                ? 'عميل أبرم عقداً ويملك وحدات داخل المحفظة.'
                : 'عميل مسجّل يتصفح المشاريع والوحدات على المنصة.'}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ContactCell
                icon={<Mail className="h-4 w-4" />}
                tone="info"
                label="البريد الإلكتروني"
                value={u.email}
                href={u.email ? `mailto:${u.email}` : undefined}
              />
              <ContactCell
                icon={<Phone className="h-4 w-4" />}
                tone="brand"
                label="رقم الهاتف"
                value={u.phone}
                href={u.phone ? `tel:${u.phone}` : undefined}
              />
              <ContactCell
                icon={<Languages className="h-4 w-4" />}
                tone="purple"
                label="اللغة المفضلة"
                value={u.locale === 'en' ? 'الإنجليزية' : 'العربية'}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* CRM Opportunities (Leads linked to this client) */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  فرص المبيعات (CRM)
                </h2>
                <span className="text-2xs font-semibold text-slate-400">
                  {leads.length}
                </span>
              </div>
              <Link href={`/dashboard/leads/new?clientId=${u.id}` as never}>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  فرصة CRM جديدة
                </Button>
              </Link>
            </div>

            <div className="mt-4">
              {leads.length === 0 ? (
                <EmptyState
                  icon={<Briefcase />}
                  title="لا توجد فرص بيع لهذا العميل"
                  description="أنشئ فرصة CRM لبدء متابعة هذا العميل في خط أنابيب المبيعات."
                  action={
                    <Link href={`/dashboard/leads/new?clientId=${u.id}` as never}>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                      >
                        إنشاء فرصة CRM
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline -mx-2">
                  {leads.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/dashboard/leads/${l.id}` as never}
                        className="flex items-center gap-3 px-2 py-3 hover:bg-surface-muted/40 rounded-lg transition-colors"
                      >
                        <span className="font-mono text-2xs text-slate-400 shrink-0">
                          #{l.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900">
                              {l.projectInterest
                                ? tx(l.projectInterest.name)
                                : 'فرصة CRM'}
                            </p>
                            <LeadStageBadge stage={l.stage} />
                          </div>
                          <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-2">
                            {l.assignedSales?.fullName ? (
                              <span className="inline-flex items-center gap-1">
                                <UserCog className="h-3 w-3" />
                                {l.assignedSales.fullName}
                              </span>
                            ) : (
                              <span className="text-slate-400">— غير مسند —</span>
                            )}
                            <span className="text-slate-300">·</span>
                            <span>{formatDate(l.createdAt)}</span>
                          </p>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-slate-300 rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  آخر النشاط
                </h2>
              </div>
              <Link
                href={`/dashboard/clients/${id}/activity` as never}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
              >
                عرض السجل الكامل
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </div>

            <div className="mt-4">
              {recentActivity.length === 0 ? (
                <EmptyState
                  icon={<Activity />}
                  title="لا يوجد نشاط بعد"
                  description="ستظهر التغييرات والعمليات هنا تلقائياً."
                />
              ) : (
                <ol className="relative ms-4 border-s-2 border-hairline ps-6 space-y-5">
                  {recentActivity.map((a) => (
                    <ActivityItem key={a.id} entry={a} />
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Account info */}
          <Card className="p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-4">
              معلومات الحساب
            </h3>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="حالة الحساب" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                {u.active ? (
                  <Badge tone="success" variant="soft" dot size="sm">
                    نشط
                  </Badge>
                ) : (
                  <Badge tone="gray" variant="soft" dot size="sm">
                    موقوف
                  </Badge>
                )}
              </Row>
              <Row label="نوع العميل" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
                <Badge
                  tone={role === 'CUSTOMER' ? 'success' : 'info'}
                  variant="soft"
                  size="sm"
                >
                  {role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                </Badge>
              </Row>
              <Row label="تاريخ التسجيل" icon={<Calendar className="h-3.5 w-3.5" />}>
                <span className="text-slate-700">{formatDate(u.createdAt)}</span>
              </Row>
              <Row label="آخر دخول" icon={<Clock className="h-3.5 w-3.5" />}>
                <span className="text-slate-700">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '— لم يدخل بعد —'}
                </span>
              </Row>
              <Row label="معرّف العميل" icon={<Hash className="h-3.5 w-3.5" />}>
                <span className="font-mono text-2xs text-slate-500">
                  #{u.id.slice(0, 8).toUpperCase()}
                </span>
              </Row>
            </dl>
          </Card>

          {/* Status / danger zone */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              حالة الحساب
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              {u.active
                ? 'يمكن للعميل تسجيل الدخول واستخدام المنصة. أوقف الحساب لمنع الوصول مؤقتاً.'
                : 'الحساب متوقف حالياً. أعد تفعيله لاستعادة وصول العميل إلى المنصة.'}
            </p>
            <div className="mt-4">
              {u.active ? (
                <ConfirmButton
                  label="إيقاف الحساب"
                  confirm="هل أنت متأكد من إيقاف هذا العميل؟ لن يتمكن من تسجيل الدخول."
                  action={deactivateClientAction.bind(null, id)}
                />
              ) : (
                <form action={activateClientAction.bind(null, id)}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    leftIcon={<Power className="h-4 w-4" />}
                  >
                    إعادة تفعيل الحساب
                  </Button>
                </form>
              )}
              {!u.active && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-2xs text-slate-500">
                  <PowerOff className="h-3 w-3 text-slate-400" />
                  الحساب موقوف منذ {formatDate(u.updatedAt ?? u.createdAt)}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 font-semibold">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function ContactCell({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
  tone: 'brand' | 'info' | 'purple';
}) {
  const ICON_TONE: Record<typeof tone, string> = {
    brand: 'bg-brand-50 text-brand-600',
    info: 'bg-info-50 text-info-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  const inner = (
    <>
      <span
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
          ICON_TONE[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className="text-sm font-medium text-slate-900 truncate"
          dir={label === 'البريد الإلكتروني' || label === 'رقم الهاتف' ? 'ltr' : undefined}
        >
          {value ?? <span className="text-slate-400">—</span>}
        </p>
      </div>
    </>
  );

  const className =
    'flex items-center gap-3 rounded-xl bg-surface-muted/60 px-3 py-2.5 ring-1 ring-inset ring-hairline';

  if (href && value) {
    return (
      <a href={href} className={cn(className, 'hover:bg-surface-muted transition-colors')}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function ActivityItem({ entry }: { entry: AuditLog }) {
  const tone =
    entry.action === 'POST'
      ? 'success'
      : entry.action === 'DELETE'
        ? 'danger'
        : 'brand';
  const dotClass: Record<typeof tone, string> = {
    success: 'bg-success-100 text-success-700 ring-success-200',
    danger: 'bg-danger-100 text-danger-700 ring-danger-200',
    brand: 'bg-brand-100 text-brand-700 ring-brand-200',
  };
  const label = ACTION_LABEL[entry.action] ?? entry.action;
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -start-[33px] top-1 inline-flex h-7 w-7 items-center justify-center rounded-full ring-2',
          dotClass[tone],
        )}
      >
        <Activity className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-900">
            <span className="font-semibold">{label}</span>{' '}
            <span className="font-mono text-xs text-slate-500">{entry.entityType}</span>
          </p>
          <p className="mt-1 text-2xs text-slate-500">
            بواسطة{' '}
            <span className="font-medium text-slate-700">
              {entry.actor?.fullName ?? '— نظام —'}
            </span>
            {entry.ip && (
              <span className="ms-2 inline-block font-mono text-slate-400" dir="ltr">
                {entry.ip}
              </span>
            )}
          </p>
        </div>
        <time className="shrink-0 text-2xs text-slate-500 tabular-nums">
          {formatDateTime(entry.createdAt)}
        </time>
      </div>
    </li>
  );
}
