import Link from 'next/link';
import {
  Building2,
  Home,
  CheckCircle2,
  Activity,
  UserPlus,
  CalendarClock,
  XCircle,
  Copy,
  BookmarkCheck,
  FileText,
  FilePen,
  BadgePercent,
  Ban,
  Wallet,
  CircleDollarSign,
  Clock,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  PortalActivityItem,
  PortalActivityType,
  PortalMe,
  PortalPerformanceResponse,
  PortalProject,
  PortalUnit,
} from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerStatusBadge, ProjectStatusBadge } from '@/components/badges';

// Latin-digit currency — avoids Arabic-Indic numeral rendering in RTL layouts
function fmtAmt(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US') + ' ر.س';
}

// ── Activity metadata ──────────────────────────────────────────────────────

const ACTIVITY_LABEL: Record<PortalActivityType, string> = {
  LEAD_SUBMITTED:        'إرسال فرصة',
  VISIT_REQUESTED:       'طلب زيارة',
  LEAD_APPROVED:         'اعتماد فرصة',
  LEAD_REJECTED:         'رفض فرصة',
  LEAD_MARKED_DUPLICATE: 'فرصة مكررة',
  RESERVATION_CREATED:   'إنشاء حجز',
  CONTRACT_CREATED:      'إنشاء عقد',
  CONTRACT_SIGNED:       'توقيع عقد',
  COMMISSION_EARNED:     'استحقاق عمولة',
  COMMISSION_APPROVED:   'اعتماد عمولة',
  COMMISSION_REJECTED:   'رفض عمولة',
  COMMISSION_CANCELLED:  'إلغاء عمولة',
  PAYOUT_CREATED:        'إنشاء دفعة',
  PAYOUT_APPROVED:       'اعتماد دفعة',
  PAYOUT_PROCESSING:     'دفعة قيد التنفيذ',
  PAYOUT_PAID:           'صرف دفعة',
  PAYOUT_CANCELLED:      'إلغاء دفعة',
};

const ACTIVITY_TONE: Record<PortalActivityType, string> = {
  LEAD_SUBMITTED:        'bg-blue-50 text-blue-600',
  VISIT_REQUESTED:       'bg-purple-50 text-purple-600',
  LEAD_APPROVED:         'bg-green-50 text-green-600',
  LEAD_REJECTED:         'bg-red-50 text-red-500',
  LEAD_MARKED_DUPLICATE: 'bg-amber-50 text-amber-600',
  RESERVATION_CREATED:   'bg-indigo-50 text-indigo-600',
  CONTRACT_CREATED:      'bg-cyan-50 text-cyan-600',
  CONTRACT_SIGNED:       'bg-emerald-50 text-emerald-600',
  COMMISSION_EARNED:     'bg-teal-50 text-teal-600',
  COMMISSION_APPROVED:   'bg-green-50 text-green-600',
  COMMISSION_REJECTED:   'bg-red-50 text-red-500',
  COMMISSION_CANCELLED:  'bg-slate-100 text-slate-500',
  PAYOUT_CREATED:        'bg-blue-50 text-blue-600',
  PAYOUT_APPROVED:       'bg-cyan-50 text-cyan-600',
  PAYOUT_PROCESSING:     'bg-amber-50 text-amber-600',
  PAYOUT_PAID:           'bg-emerald-50 text-emerald-600',
  PAYOUT_CANCELLED:      'bg-slate-100 text-slate-500',
};

function ActivityIcon({ type }: { type: PortalActivityType }) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'LEAD_SUBMITTED':        return <UserPlus className={cls} />;
    case 'VISIT_REQUESTED':       return <CalendarClock className={cls} />;
    case 'LEAD_APPROVED':         return <CheckCircle2 className={cls} />;
    case 'LEAD_REJECTED':         return <XCircle className={cls} />;
    case 'LEAD_MARKED_DUPLICATE': return <Copy className={cls} />;
    case 'RESERVATION_CREATED':   return <BookmarkCheck className={cls} />;
    case 'CONTRACT_CREATED':      return <FileText className={cls} />;
    case 'CONTRACT_SIGNED':       return <FilePen className={cls} />;
    case 'COMMISSION_EARNED':
    case 'COMMISSION_APPROVED':   return <BadgePercent className={cls} />;
    case 'COMMISSION_REJECTED':   return <XCircle className={cls} />;
    case 'COMMISSION_CANCELLED':  return <Ban className={cls} />;
    case 'PAYOUT_CREATED':
    case 'PAYOUT_APPROVED':       return <Wallet className={cls} />;
    case 'PAYOUT_PROCESSING':     return <Clock className={cls} />;
    case 'PAYOUT_PAID':           return <CircleDollarSign className={cls} />;
    case 'PAYOUT_CANCELLED':      return <Ban className={cls} />;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalDashboard() {
  const [meRes, projectsRes, availableUnitsRes, activityRes, perfRes] = await Promise.all([
    safe(api.get<PortalMe>('/portal/me')),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<Paged<PortalActivityItem>>('/portal/activity?pageSize=8')),
    safe(api.get<PortalPerformanceResponse>('/portal/performance')),
  ]);

  if (meRes.error || !meRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات البوابة: {meRes.error ?? 'غير متاحة'}
      </div>
    );
  }

  const me             = meRes.data;
  const projects       = projectsRes.data ?? [];
  const availableCount = availableUnitsRes.data?.meta.total ?? 0;
  const activity       = activityRes.data?.data ?? [];
  const perf           = perfRes.data?.summary;
  const hasContract    = !!(me.broker.contractStartAt && me.broker.contractEndAt);

  return (
    <div className="space-y-5">

      {/* ── 1. Welcome header ─────────────────────────────────────────────── */}
      <PageHeader
        title={`أهلاً، ${me.user.fullName}`}
        description="مساحة العمل الخاصة بك — المشاريع والوحدات المتاحة، وآخر نشاطك."
        breadcrumbs={[{ label: 'البوابة' }, { label: 'لوحة التحكم' }]}
        meta={
          <>
            <span className="text-xs font-medium text-slate-700">{me.broker.companyName}</span>
            <BrokerStatusBadge status={me.broker.status} />
            <span className="font-mono text-xs text-slate-500" dir="ltr">{me.broker.code}</span>
          </>
        }
      />

      {/* ── 2. Broker account strip ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-hairline bg-white px-5 py-3 shadow-xs text-xs">
        <div className="flex items-center gap-1.5">
          <BadgePercent className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-slate-500">النسبة الافتراضية</span>
          <span className="font-semibold text-amber-700">
            {Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}%
          </span>
        </div>
        <div className="w-px h-4 bg-hairline hidden sm:block" />
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500">عقد الوساطة</span>
          {hasContract ? (
            <span className="text-slate-700 tabular-nums" dir="ltr">
              {formatDate(me.broker.contractStartAt)} — {formatDate(me.broker.contractEndAt)}
            </span>
          ) : (
            <span className="text-slate-400">غير محدد</span>
          )}
        </div>
        {me.permissions.isPrimaryContact && (
          <>
            <div className="w-px h-4 bg-hairline hidden sm:block" />
            <span className="text-brand-700 font-medium">جهة الاتصال الرئيسية</span>
          </>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {(projectsRes.error || availableUnitsRes.error) && (
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات.
        </div>
      )}

      {/* ── 3. KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <PageKpiCard label="المشاريع المتاحة" value={String(projects.length)}                       icon={<Building2 />}     tone="brand"   compact />
        <PageKpiCard label="وحدات للبيع"       value={String(availableCount)}                        icon={<CheckCircle2 />}  tone="success" compact />
        <PageKpiCard label="فرص مرسلة"         value={perf ? String(perf.leadsSubmitted) : '—'}      icon={<UserPlus />}      tone="info"    compact />
        <PageKpiCard label="حجوزات"            value={perf ? String(perf.reservationsCreated) : '—'} icon={<BookmarkCheck />} tone="accent"  compact />
        <PageKpiCard label="عقود موقّعة"       value={perf ? String(perf.contractsSigned) : '—'}     icon={<FileText />}      tone="teal"    compact />
        <PageKpiCard label="مدفوع (صافي)"      value={perf ? fmtAmt(perf.payoutsTotalNet) : '—'}     icon={<Wallet />}        tone="warning" compact />
      </div>

      {/* ── 4. Dashboard grid ─────────────────────────────────────────────── */}
      {/*
        Desktop RTL layout (12 cols):
          Row 1:  [Available Projects col-span-8] [Quick Actions col-span-4]
          Row 2:  [Latest Activity col-span-12]
        Mobile:
          1. Quick Actions  (order-1)
          2. Available Projects  (order-2)
          3. Latest Activity  (order-3)
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:items-stretch">

        {/* ── Available Projects (8/12) — visual right in RTL ──────────────── */}
        <Card className="order-2 lg:order-1 lg:col-span-8 p-0 overflow-hidden lg:flex lg:flex-col lg:h-full">
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline">
            <h2 className="text-sm font-semibold text-slate-800">المشاريع المتاحة</h2>
            <Link
              href="/portal/projects"
              className="text-xs text-slate-400 hover:text-brand-700 transition-colors"
            >
              عرض الكل
            </Link>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="لا توجد مشاريع مسموح بها بعد"
              description="سيتواصل معك مدير المشاريع لمنح الصلاحيات."
              className="py-10"
            />
          ) : (
            /* Slightly gray wrapper so white cards float above it */
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/30 flex-1">
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.project.id}
                  className="flex flex-col justify-between rounded-xl bg-white border border-slate-100 p-5 hover:border-brand-200 hover:shadow-sm transition-all"
                >
                  {/* Content block */}
                  <div className="flex flex-col gap-3">
                    {/* Icon + name + city */}
                    <div className="flex items-start gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Building2 className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm leading-snug truncate">
                          {tx(p.project.name)}
                        </p>
                        {p.project.city && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{p.project.city}</p>
                        )}
                      </div>
                    </div>
                    {/* Status + commission badges — one compact row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProjectStatusBadge status={p.project.status} />
                      {p.access.commissionPct != null && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 text-amber-700 text-2xs font-semibold px-1.5 py-0.5 ring-1 ring-inset ring-amber-100 whitespace-nowrap">
                          <BadgePercent className="h-2.5 w-2.5" />
                          عمولة {Number(p.access.commissionPct).toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA — sits at bottom, pushed down by flex-1 content */}
                  <Link
                    href="/portal/units"
                    className="flex items-center justify-center gap-1.5 h-8 w-full rounded-lg border border-brand-200 bg-brand-50/50 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                  >
                    <Home className="h-3 w-3" />
                    عرض الوحدات
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Quick Actions (4/12) — visual left in RTL ────────────────────── */}
        <div className="order-1 lg:order-2 lg:col-span-4 lg:flex lg:flex-col">
          <Card className="p-5 lg:h-full lg:flex lg:flex-col">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">إجراءات سريعة</h2>

            {/* Primary CTA */}
            <Link href="/portal/leads/new">
              <Button
                variant="primary"
                size="md"
                leftIcon={<UserPlus className="h-4 w-4" />}
                fullWidth
              >
                إضافة فرصة
              </Button>
            </Link>

            {/* Secondary CTAs */}
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <Link href="/portal/visits/new">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
                  fullWidth
                >
                  طلب زيارة
                </Button>
              </Link>
              <Link href="/portal/reservations/new">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<BookmarkCheck className="h-3.5 w-3.5" />}
                  fullWidth
                >
                  حجز جديد
                </Button>
              </Link>
            </div>

            {/* Browse shortcuts — compact rows, 2×2 */}
            <div className="border-t border-hairline mt-4 pt-3">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { href: '/portal/projects',   icon: <Building2 />,    label: 'المشاريع'  },
                  { href: '/portal/units',       icon: <Home />,         label: 'الوحدات'   },
                  { href: '/portal/commissions', icon: <BadgePercent />, label: 'العمولات'  },
                  { href: '/portal/payouts',     icon: <Wallet />,       label: 'المدفوعات' },
                ].map(({ href, icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-brand-50 transition-colors group"
                  >
                    <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 text-slate-400 group-hover:text-brand-600 transition-colors shrink-0">
                      {icon}
                    </span>
                    <span className="text-sm font-medium text-slate-600 group-hover:text-brand-700 transition-colors">
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Latest Activity (12/12) — full width, 2-col internal feed ─────── */}
        {(activity.length > 0 || !activityRes.error) && (
          <Card className="order-3 lg:col-span-12 p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline">
              <h2 className="text-sm font-semibold text-slate-800">أحدث النشاط</h2>
              <Link
                href="/portal/activity"
                className="text-sm text-brand-700 hover:text-brand-800 transition-colors"
              >
                عرض الكل
              </Link>
            </div>

            {activityRes.error ? (
              <p className="px-5 py-4 text-sm text-danger-700">تعذر تحميل النشاط.</p>
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Activity className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">لا يوجد نشاط بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
                {activity.slice(0, 6).map((item) => {
                  const linkHref =
                    item.entityType === 'VisitRequest'
                      ? '/portal/visits'
                      : item.entityType === 'Reservation'
                        ? `/portal/reservations/${item.entityId}`
                        : item.entityType === 'Contract'
                          ? `/portal/contracts/${item.entityId}`
                          : item.entityType === 'Commission'
                            ? `/portal/commissions/${item.entityId}`
                            : item.entityType === 'Payout'
                              ? `/portal/payouts/${item.entityId}`
                              : item.lead
                                ? `/portal/leads/${item.lead.id}`
                                : '/portal/activity';

                  const subtitle = item.lead
                    ? [
                        item.lead.fullName,
                        item.lead.projectInterest ? tx(item.lead.projectInterest.name) : null,
                      ].filter(Boolean).join(' · ')
                    : 'على مستوى شركة الوساطة';

                  return (
                    <Link
                      key={item.id}
                      href={linkHref as never}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 hover:bg-white hover:shadow-sm transition-all"
                    >
                      {/* Icon */}
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                          ACTIVITY_TONE[item.type],
                        )}
                      >
                        <ActivityIcon type={item.type} />
                      </span>

                      {/* Title + subtitle + date */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 leading-snug truncate">
                          {ACTIVITY_LABEL[item.type]}
                        </p>
                        <p className="text-xs truncate mt-0.5">
                          <span className="text-slate-500">{subtitle}</span>
                          <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
                          <time className="text-slate-400 tabular-nums" dir="ltr">
                            {formatDateTime(item.createdAt)}
                          </time>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
