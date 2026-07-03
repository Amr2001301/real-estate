import Link from 'next/link';
import {
  Phone,
  Mail,
  Languages,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
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
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MaintenanceStatusBadge } from '@/components/badges';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
  PremiumEmptyState,
} from '@/components/premium';

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

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currency = await getReportsCurrency();
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
    <div className="space-y-5">
      <PremiumPageHero
        title={u.fullName}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء', href: '/dashboard/customers' },
          { label: u.fullName },
        ]}
        meta={
          <>
            <Badge tone="success" variant="soft">عميل</Badge>
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
                <Button type="button" variant="outline" size="md" leftIcon={<Phone className="h-4 w-4" />}>
                  اتصال
                </Button>
              </a>
            )}
            <Link href={`/dashboard/clients/${id}` as never}>
              <Button variant="primary" size="md" leftIcon={<UserCog className="h-4 w-4" />}>
                الملف الكامل
              </Button>
            </Link>
          </>
        }
      />

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          {
            label: 'العقود',
            value: contracts.length,
            icon: <FileText className="h-4 w-4" />,
            tone: 'brand',
          },
          {
            label: 'طلبات صيانة مفتوحة',
            value: openMaintenance,
            icon: <Wrench className="h-4 w-4" />,
            tone: 'warning',
          },
          {
            label: 'إجمالي طلبات الصيانة',
            value: maintenance.length,
            icon: <Wrench className="h-4 w-4" />,
            tone: 'success',
          },
          {
            label: 'المستندات',
            value: documents.length,
            icon: <Files className="h-4 w-4" />,
            tone: 'info',
          },
        ]}
      />

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            <PremiumSectionCard title="الملف الشخصي">
              {/* Avatar + name row */}
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-[26px] font-extrabold ring-4 ring-white shadow uppercase',
                    paletteFor(u.fullName ?? u.id),
                  )}
                  aria-hidden
                >
                  {initials(u.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[22px] font-bold text-navy tracking-tight truncate leading-tight">
                    {u.fullName}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="success" variant="soft" size="sm" dot>مالك</Badge>
                    <Badge tone={u.active ? 'success' : 'gray'} variant="soft" size="sm">
                      {u.active ? 'نشط' : 'موقوف'}
                    </Badge>
                    <span className="text-2xs font-mono text-slate-400 ms-1">
                      عضو منذ {formatDate(u.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact cells */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
            </PremiumSectionCard>

            <PremiumSectionCard
              title="العقود"
              icon={<FileText className="h-4 w-4" />}
              padded={false}
            >
              {contracts.length === 0 ? (
                <PremiumEmptyState
                  icon={<FileText />}
                  title="لا توجد عقود لهذا العميل"
                  description="سيظهر هنا أي عقد يتم تسجيله باسم العميل."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {contracts.map((c) => {
                    const projectName = c.unit?.building?.phase?.project?.name
                      ? tx(c.unit.building.phase.project.name)
                      : null;
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/contracts/${c.id}` as never}
                          className="group flex items-center gap-3.5 px-5 py-4 hover:bg-canvas/40 transition-colors"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                            <FileText />
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Top line: project · unit  |  price */}
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-[13.5px] font-semibold text-slate-900 truncate leading-snug">
                                {projectName ? `${projectName} · ` : ''}وحدة {c.unit?.code ?? '—'}
                              </p>
                              <p className="shrink-0 text-[14px] font-bold text-slate-800 tabular-nums leading-snug">
                                {formatCurrency(c.totalAmount, currency)}
                              </p>
                            </div>
                            {/* Bottom line: contract# · date  |  signed badge */}
                            <div className="flex items-center justify-between gap-3 mt-1.5">
                              <p className="text-2xs text-slate-400 inline-flex items-center gap-1.5 min-w-0 truncate">
                                <span className="font-mono">{c.contractNumber ?? `#${c.id.slice(0, 8).toUpperCase()}`}</span>
                                <span className="text-slate-300">·</span>
                                <span>{formatDate(c.createdAt)}</span>
                              </p>
                              {c.signedAt ? (
                                <Badge tone="success" variant="soft" size="sm" dot>مُوقَّع</Badge>
                              ) : (
                                <Badge tone="warning" variant="soft" size="sm" dot>بانتظار</Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard
              title="طلبات الصيانة"
              icon={<Wrench className="h-4 w-4" />}
              padded={false}
            >
              {maintenance.length === 0 ? (
                <PremiumEmptyState
                  icon={<Wrench />}
                  title="لا توجد طلبات صيانة"
                  description="سيظهر هنا أي طلب صيانة يقوم به العميل."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {maintenance.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/dashboard/maintenance/${m.id}` as never}
                        className="group flex items-center gap-3.5 px-5 py-4 hover:bg-canvas/40 transition-colors"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                          <Wrench />
                        </span>
                        <div className="min-w-0 flex-1">
                          {/* Top line: category · unit  |  status badge */}
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13.5px] font-semibold text-slate-900 truncate leading-snug">
                              {m.category ? tx(m.category.name) : 'طلب صيانة'}
                              {m.unit ? ` · وحدة ${m.unit.code}` : ''}
                            </p>
                            <MaintenanceStatusBadge status={m.status} />
                          </div>
                          {/* Description: 1 line clamp */}
                          {m.description && (
                            <p className="text-2xs text-slate-500 mt-1 line-clamp-1 leading-relaxed">
                              {m.description}
                            </p>
                          )}
                          {/* Bottom line: mono ID · date */}
                          <p className="text-2xs text-slate-400 mt-1 inline-flex items-center gap-1.5">
                            <span className="font-mono">#{m.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-slate-300">·</span>
                            <span>{formatDate(m.createdAt)}</span>
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard
              title="المستندات"
              icon={<Files className="h-4 w-4" />}
              padded={false}
            >
              {documents.length === 0 ? (
                <PremiumEmptyState
                  icon={<Files />}
                  title="لا توجد مستندات"
                  description="سيظهر هنا أي مستند يتم رفعه للعميل (هوية، مرفقات، إلخ)."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3.5 px-5 py-4 hover:bg-canvas/40 transition-colors"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-50 text-info-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                          <Files />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold text-slate-900 truncate">{d.title}</p>
                          <p className="text-2xs text-slate-400 mt-1 inline-flex items-center gap-2 flex-wrap">
                            <Badge tone="info" variant="soft" size="sm">{d.category}</Badge>
                            <span className="text-slate-300">·</span>
                            <span>{formatDate(d.createdAt)}</span>
                            {d.uploadedBy?.fullName && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span>رفعها {d.uploadedBy.fullName}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <Download className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400 transition-colors" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </PremiumSectionCard>
          </div>
        }
        side={
          <div className="space-y-5">
            <PremiumCommandPanel title="روابط سريعة">
              <Link href={`/dashboard/contracts?customerId=${u.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><FileText /></span>
                عقود العميل
              </Link>
              <Link href={`/dashboard/maintenance?customerId=${u.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><Wrench /></span>
                طلبات الصيانة
              </Link>
              <Link href={`/dashboard/documents?ownerType=USER&ownerId=${u.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><Files /></span>
                مستندات العميل
              </Link>
              <Link href={`/dashboard/clients/${u.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><UserCog /></span>
                الملف الكامل (CRM + زيارات + حجوزات)
              </Link>
            </PremiumCommandPanel>

            <PremiumSectionCard title="معلومات الحساب" padded={false}>
              <dl className="flex flex-col divide-y divide-hairline">
                <Row label="حالة الحساب" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  {u.active ? (
                    <Badge tone="success" variant="soft" dot size="sm">نشط</Badge>
                  ) : (
                    <Badge tone="gray" variant="soft" dot size="sm">موقوف</Badge>
                  )}
                </Row>
                <Row label="نوع العميل" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
                  <Badge tone="success" variant="soft" size="sm">مالك</Badge>
                </Row>
                <Row label="تاريخ التسجيل" icon={<Calendar className="h-3.5 w-3.5" />}>
                  <span className="text-[13px] font-medium text-slate-700">{formatDate(u.createdAt)}</span>
                </Row>
                <Row label="آخر دخول" icon={<Clock className="h-3.5 w-3.5" />}>
                  <span className="text-[13px] font-medium text-slate-700">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-slate-400">لم يدخل بعد</span>}
                  </span>
                </Row>
                <Row label="معرّف العميل" icon={<Hash className="h-3.5 w-3.5" />}>
                  <span className="font-mono text-2xs text-slate-500">
                    #{u.id.slice(0, 8).toUpperCase()}
                  </span>
                </Row>
              </dl>
            </PremiumSectionCard>

            {contracts[0]?.unit?.building?.phase?.project && (
              <PremiumSectionCard title="المشروع الأخير" icon={<Building2 className="h-4 w-4" />}>
                <p className="text-sm text-slate-700">
                  {tx(contracts[0]!.unit!.building!.phase!.project!.name)}
                </p>
                <p className="mt-1 text-2xs text-slate-500">
                  وحدة {contracts[0]!.unit!.code}
                </p>
              </PremiumSectionCard>
            )}
          </div>
        }
      />
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
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-400 font-semibold shrink-0">
        <span className="text-slate-300">{icon}</span>
        {label}
      </dt>
      <dd className="text-end min-w-0">{children}</dd>
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
    'flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline';

  if (href && value) {
    return (
      <a href={href} className={cn(className, 'hover:bg-canvas transition-colors')}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}
