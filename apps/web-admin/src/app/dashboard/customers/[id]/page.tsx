import Link from 'next/link';
import {
  Phone,
  Mail,
  Languages,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Hash,
  FileText,
  Wrench,
  Files,
  Building2,
  UserCog,
  Download,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  User,
  Contract,
  MaintenanceRequest,
  DocumentItem,
  Paged,
} from '@/lib/types';
import { formatDate, formatDateTime, formatCurrency, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MaintenanceStatusBadge } from '@/components/badges';
import { cn } from '@/lib/cn';

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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [userRes, contractsRes, maintenanceRes, documentsRes] = await Promise.all([
    safe(api.get<User>(`/users/${id}`)),
    safe(api.get<Paged<Contract>>(`/contracts?customerId=${id}&pageSize=20`)),
    safe(
      api.get<Paged<MaintenanceRequest>>(
        `/maintenance-requests?customerId=${id}&pageSize=20`,
      ),
    ),
    safe(
      api.get<Paged<DocumentItem>>(
        `/documents?ownerType=USER&ownerId=${id}&pageSize=20`,
      ),
    ),
  ]);

  if (userRes.error || !userRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل العميل: {userRes.error ?? 'غير موجود'}
      </div>
    );
  }

  const u = userRes.data;
  const contracts = contractsRes.data?.data ?? [];
  const maintenance = maintenanceRes.data?.data ?? [];
  const documents = documentsRes.data?.data ?? [];

  const openMaintenance = maintenance.filter(
    (m) => m.status !== 'RESOLVED' && m.status !== 'CLOSED',
  ).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={u.fullName}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء', href: '/dashboard/customers' },
          { label: u.fullName },
        ]}
        meta={
          <>
            <Badge tone="success" variant="soft">
              عميل
            </Badge>
            <Badge tone={u.active ? 'success' : 'gray'} variant="soft" dot>
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
            <Link href={`/dashboard/clients/${id}` as never}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<UserCog className="h-4 w-4" />}
              >
                الملف الكامل
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
              <Badge tone="success" variant="soft" size="sm">
                مالك حالي
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              عميل أبرم عقداً ويملك وحدات داخل المحفظة.
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

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          tone="brand"
          label="العقود"
          value={contracts.length}
        />
        <StatCard
          icon={<Wrench className="h-4 w-4" />}
          tone="warning"
          label="طلبات صيانة مفتوحة"
          value={openMaintenance}
        />
        <StatCard
          icon={<Wrench className="h-4 w-4" />}
          tone="success"
          label="إجمالي طلبات الصيانة"
          value={maintenance.length}
        />
        <StatCard
          icon={<Files className="h-4 w-4" />}
          tone="info"
          label="المستندات"
          value={documents.length}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Contracts */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  العقود
                </h2>
                <span className="text-2xs font-semibold text-slate-400">
                  {contracts.length}
                </span>
              </div>
              {contracts.length > 0 && (
                <Link
                  href={`/dashboard/contracts?customerId=${u.id}` as never}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  عرض كل العقود
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              )}
            </div>

            <div className="mt-4">
              {contracts.length === 0 ? (
                <EmptyState
                  icon={<FileText />}
                  title="لا توجد عقود لهذا العميل"
                  description="سيظهر هنا أي عقد يتم تسجيله باسم العميل."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline -mx-2">
                  {contracts.map((c) => {
                    const projectName = c.unit?.building?.phase?.project?.name
                      ? tx(c.unit.building.phase.project.name)
                      : null;
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/contracts/${c.id}` as never}
                          className="flex items-center gap-3 px-2 py-3 hover:bg-surface-muted/40 rounded-lg transition-colors"
                        >
                          <span className="font-mono text-2xs text-slate-400 shrink-0">
                            {c.contractNumber ?? `#${c.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {projectName ? `${projectName} · ` : ''}
                                وحدة {c.unit?.code ?? '—'}
                              </p>
                              {c.signedAt ? (
                                <Badge tone="success" variant="soft" size="sm" dot>
                                  مُوقَّع
                                </Badge>
                              ) : (
                                <Badge tone="warning" variant="soft" size="sm" dot>
                                  بانتظار التوقيع
                                </Badge>
                              )}
                            </div>
                            <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-2 flex-wrap">
                              <span>قيمة العقد: {formatCurrency(c.totalAmount)}</span>
                              <span className="text-slate-300">·</span>
                              <span>{formatDate(c.createdAt)}</span>
                            </p>
                          </div>
                          <ArrowLeft className="h-4 w-4 text-slate-300 rtl:rotate-180" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {/* Maintenance requests */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  طلبات الصيانة
                </h2>
                <span className="text-2xs font-semibold text-slate-400">
                  {maintenance.length}
                </span>
              </div>
              {maintenance.length > 0 && (
                <Link
                  href={`/dashboard/maintenance?customerId=${u.id}` as never}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  عرض كل الطلبات
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              )}
            </div>

            <div className="mt-4">
              {maintenance.length === 0 ? (
                <EmptyState
                  icon={<Wrench />}
                  title="لا توجد طلبات صيانة"
                  description="سيظهر هنا أي طلب صيانة يقوم به العميل."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline -mx-2">
                  {maintenance.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/dashboard/maintenance/${m.id}` as never}
                        className="flex items-center gap-3 px-2 py-3 hover:bg-surface-muted/40 rounded-lg transition-colors"
                      >
                        <span className="font-mono text-2xs text-slate-400 shrink-0">
                          #{m.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {m.category ? tx(m.category.name) : 'طلب صيانة'}
                              {m.unit ? ` · وحدة ${m.unit.code}` : ''}
                            </p>
                            <MaintenanceStatusBadge status={m.status} />
                          </div>
                          <p className="text-2xs text-slate-500 mt-0.5 truncate">
                            {m.description}
                          </p>
                          <p className="text-2xs text-slate-400 mt-0.5">
                            {formatDate(m.createdAt)}
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

          {/* Documents */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Files className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  المستندات
                </h2>
                <span className="text-2xs font-semibold text-slate-400">
                  {documents.length}
                </span>
              </div>
              {documents.length > 0 && (
                <Link
                  href={
                    `/dashboard/documents?ownerType=USER&ownerId=${u.id}` as never
                  }
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  عرض كل المستندات
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              )}
            </div>

            <div className="mt-4">
              {documents.length === 0 ? (
                <EmptyState
                  icon={<Files />}
                  title="لا توجد مستندات"
                  description="سيظهر هنا أي مستند يتم رفعه للعميل (هوية، مرفقات، إلخ)."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline -mx-2">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-2 py-3 hover:bg-surface-muted/40 rounded-lg transition-colors"
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-info-50 text-info-600 shrink-0">
                          <Files className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {d.title}
                          </p>
                          <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-2 flex-wrap">
                            <Badge tone="info" variant="soft" size="sm">
                              {d.category}
                            </Badge>
                            <span>{formatDate(d.createdAt)}</span>
                            {d.uploadedBy?.fullName && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span>رفعها {d.uploadedBy.fullName}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <Download className="h-4 w-4 text-slate-300" />
                      </a>
                    </li>
                  ))}
                </ul>
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
                <Badge tone="success" variant="soft" size="sm">
                  مالك
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

          {/* Quick links */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              روابط سريعة
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              قوائم مفلترة على هذا العميل عبر الأقسام الأخرى.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <QuickLink
                href={`/dashboard/contracts?customerId=${u.id}`}
                icon={<FileText className="h-4 w-4" />}
                label="عقود العميل"
              />
              <QuickLink
                href={`/dashboard/maintenance?customerId=${u.id}`}
                icon={<Wrench className="h-4 w-4" />}
                label="طلبات الصيانة"
              />
              <QuickLink
                href={`/dashboard/documents?ownerType=USER&ownerId=${u.id}`}
                icon={<Files className="h-4 w-4" />}
                label="مستندات العميل"
              />
              <QuickLink
                href={`/dashboard/clients/${u.id}`}
                icon={<UserCog className="h-4 w-4" />}
                label="الملف الكامل (CRM + زيارات + حجوزات)"
              />
            </div>
          </Card>

          {contracts[0]?.unit?.building?.phase?.project && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight inline-flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-600" />
                المشروع الأخير
              </h3>
              <p className="mt-2 text-sm text-slate-700">
                {tx(contracts[0]!.unit!.building!.phase!.project!.name)}
              </p>
              <p className="mt-1 text-2xs text-slate-500">
                وحدة {contracts[0]!.unit!.code}
              </p>
            </Card>
          )}
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'success' | 'warning';
}) {
  const ICON_TONE: Record<typeof tone, string> = {
    brand: 'bg-brand-50 text-brand-600',
    info: 'bg-info-50 text-info-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
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
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href as never}
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-surface-muted/60 hover:text-brand-700 transition-colors"
    >
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1">{label}</span>
      <ArrowLeft className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
    </Link>
  );
}
