import Link from 'next/link';
import {
  Building2,
  Home,
  UserPlus,
  BookmarkCheck,
  FileText,
  Wallet,
  TrendingUp,
  CalendarClock,
  BadgePercent,
  CheckCircle2,
  Activity,
  FilePen,
  CircleDollarSign,
  Copy,
  XCircle,
  Ban,
  Clock,
  MapPin,
  ShieldCheck,
  ArrowUpRight,
  Bell,
  ChevronLeft,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  PortalActivityItem,
  PortalActivityType,
  PortalLead,
  PortalMe,
  PortalPayout,
  PortalPerformanceResponse,
  PortalProject,
  PortalUnit,
  PortalVisitRequest,
} from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency, formatCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerStatusBadge, BrokerLeadStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Helpers ──────────────────────────────────────────────────────────────

function convPct(num: number, denom: number): string | null {
  if (denom <= 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function avatarColor(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

// ── Activity meta ─────────────────────────────────────────────────────────

const ACTIVITY_META: Record<PortalActivityType, { label: string; color: string }> = {
  LEAD_SUBMITTED:        { label: 'إرسال فرصة',       color: 'bg-blue-50 text-blue-600'       },
  VISIT_REQUESTED:       { label: 'طلب زيارة',         color: 'bg-purple-50 text-purple-600'   },
  LEAD_APPROVED:         { label: 'اعتماد فرصة',       color: 'bg-green-50 text-green-600'     },
  LEAD_REJECTED:         { label: 'رفض فرصة',          color: 'bg-red-50 text-red-500'         },
  LEAD_MARKED_DUPLICATE: { label: 'فرصة مكررة',        color: 'bg-amber-50 text-amber-600'     },
  RESERVATION_CREATED:   { label: 'إنشاء حجز',         color: 'bg-indigo-50 text-indigo-600'   },
  CONTRACT_CREATED:      { label: 'إنشاء عقد',         color: 'bg-cyan-50 text-cyan-600'       },
  CONTRACT_SIGNED:       { label: 'توقيع عقد',         color: 'bg-emerald-50 text-emerald-600' },
  COMMISSION_EARNED:     { label: 'استحقاق عمولة',     color: 'bg-teal-50 text-teal-600'       },
  COMMISSION_APPROVED:   { label: 'اعتماد عمولة',      color: 'bg-green-50 text-green-600'     },
  COMMISSION_REJECTED:   { label: 'رفض عمولة',         color: 'bg-red-50 text-red-500'         },
  COMMISSION_CANCELLED:  { label: 'إلغاء عمولة',       color: 'bg-slate-100 text-slate-500'    },
  PAYOUT_CREATED:        { label: 'إنشاء دفعة',        color: 'bg-blue-50 text-blue-600'       },
  PAYOUT_APPROVED:       { label: 'اعتماد دفعة',       color: 'bg-cyan-50 text-cyan-600'       },
  PAYOUT_PROCESSING:     { label: 'دفعة قيد التنفيذ',  color: 'bg-amber-50 text-amber-600'     },
  PAYOUT_PAID:           { label: 'صرف دفعة',          color: 'bg-emerald-50 text-emerald-600' },
  PAYOUT_CANCELLED:      { label: 'إلغاء دفعة',        color: 'bg-slate-100 text-slate-500'    },
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

// ── Pipeline stage type ───────────────────────────────────────────────────

interface PipelineStage {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  iconBg: string;
  iconText: string;
  bar: string;
  convRate: string | null;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function PortalDashboard() {
  const [
    meRes, projectsRes, unitsRes, activityRes, perfRes,
    leadsRes, pendingLeadsRes, newVisitsRes, approvedPayoutsRes,
  ] = await Promise.all([
    safe(api.get<PortalMe>('/portal/me')),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<Paged<PortalActivityItem>>('/portal/activity?pageSize=6')),
    safe(api.get<PortalPerformanceResponse>('/portal/performance')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?pageSize=5')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?pageSize=1&status=PENDING')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?requestStatus=NEW&pageSize=1')),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?status=APPROVED&pageSize=1')),
  ]);

  if (meRes.error || !meRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات البوابة.
      </div>
    );
  }

  const me                   = meRes.data;
  const projects             = projectsRes.data ?? [];
  const availableCount       = unitsRes.data?.meta.total ?? 0;
  const activity             = activityRes.data?.data ?? [];
  const perf                 = perfRes.data?.summary;
  const recentLeads          = leadsRes.data?.data ?? [];
  const pendingLeadsCount    = pendingLeadsRes.data?.meta.total ?? 0;
  const newVisitsCount       = newVisitsRes.data?.meta.total ?? 0;
  const approvedPayoutsCount = approvedPayoutsRes.data?.meta.total ?? 0;
  const totalActions         = pendingLeadsCount + newVisitsCount + approvedPayoutsCount;
  const hasContract          = !!(me.broker.contractStartAt && me.broker.contractEndAt);

  const pipeline: PipelineStage[] = perf
    ? [
        { Icon: UserPlus,         label: 'فرص مُرسلة',  value: perf.leadsSubmitted,      iconBg: 'bg-brand-50',   iconText: 'text-brand-600',   bar: 'bg-brand-300',   convRate: null },
        { Icon: ShieldCheck,      label: 'فرص معتمدة',  value: perf.leadsApproved,       iconBg: 'bg-blue-50',    iconText: 'text-blue-600',    bar: 'bg-blue-300',    convRate: convPct(perf.leadsApproved, perf.leadsSubmitted) },
        { Icon: BookmarkCheck,    label: 'حجوزات',       value: perf.reservationsCreated, iconBg: 'bg-violet-50',  iconText: 'text-violet-600',  bar: 'bg-violet-300',  convRate: convPct(perf.reservationsCreated, perf.leadsApproved) },
        { Icon: FilePen,          label: 'عقود موقّعة', value: perf.contractsSigned,     iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', bar: 'bg-emerald-300', convRate: convPct(perf.contractsSigned, perf.reservationsCreated) },
        { Icon: CircleDollarSign, label: 'مدفوعات',      value: perf.payoutsPaid,         iconBg: 'bg-teal-50',    iconText: 'text-teal-600',    bar: 'bg-teal-300',    convRate: convPct(perf.payoutsPaid, perf.contractsSigned) },
      ]
    : [];

  const pipelineMax = Math.max(...pipeline.map((s) => s.value), 1);

  return (
    <div className="space-y-4">

      {/* ── 1. Compact hero header ──────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-hairline shadow-xs px-5 py-4">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white font-extrabold text-sm tracking-wide">
                {initials(me.user.fullName)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                  أهلاً، {me.user.fullName}
                </h1>
                <BrokerStatusBadge status={me.broker.status} />
                <span
                  className="font-mono text-2xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-hairline hidden sm:inline"
                  dir="ltr"
                >
                  {me.broker.code}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                <span className="font-semibold text-slate-600">{me.broker.companyName}</span>
                <span className="text-slate-200 select-none">·</span>
                <span className="inline-flex items-center gap-1">
                  <BadgePercent className="h-3 w-3 text-amber-500 shrink-0" />
                  <span className="font-extrabold text-amber-700 tabular-nums">
                    {Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}%
                  </span>
                  <span className="text-slate-400">عمولة</span>
                </span>
                {hasContract && (
                  <>
                    <span className="text-slate-200 select-none">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-500" dir="ltr">
                      <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="tabular-nums">
                        {formatDate(me.broker.contractStartAt)} – {formatDate(me.broker.contractEndAt)}
                      </span>
                    </span>
                  </>
                )}
                {me.permissions.isPrimaryContact && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-2xs font-semibold ring-1 ring-inset ring-brand-100">
                    <CheckCircle2 className="h-3 w-3" />
                    جهة الاتصال الرئيسية
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href="/portal/leads/new" className="shrink-0">
            <Button variant="primary" size="md" leftIcon={<UserPlus className="h-4 w-4" />}>
              + فرصة جديدة
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 2. KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Leads submitted */}
        <Link href="/portal/leads" className="block group">
          <div className="h-full rounded-2xl bg-white border border-hairline shadow-xs p-4 group-hover:border-brand-200 group-hover:shadow-card transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-brand-600" />
              </div>
              {perf && perf.leadsSubmitted > 0 && (
                <span className="text-2xs font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full tabular-nums">
                  {Math.round((perf.leadsApproved / perf.leadsSubmitted) * 100)}% قبول
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums leading-none">
              {perf ? perf.leadsSubmitted.toLocaleString() : '—'}
            </p>
            <p className="text-xs font-semibold text-slate-600 mt-1.5">فرصي المُرسلة</p>
            {perf && (
              <p className="text-2xs text-brand-600 mt-1 font-semibold">
                {perf.leadsApproved} معتمدة
              </p>
            )}
            {perf && perf.leadsSubmitted > 0 && (
              <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-400 transition-all"
                  style={{ width: `${Math.min(Math.round((perf.leadsApproved / perf.leadsSubmitted) * 100), 100)}%` }}
                />
              </div>
            )}
          </div>
        </Link>

        {/* Reservations + contracts */}
        <Link href="/portal/reservations" className="block group">
          <div className="h-full rounded-2xl bg-white border border-hairline shadow-xs p-4 group-hover:border-violet-200 group-hover:shadow-card transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                <BookmarkCheck className="h-4 w-4 text-violet-600" />
              </div>
              {perf && perf.reservationsCreated > 0 && (
                <span className="text-2xs font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full tabular-nums">
                  {Math.round((perf.contractsSigned / perf.reservationsCreated) * 100)}% إغلاق
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums leading-none">
              {perf ? perf.reservationsCreated.toLocaleString() : '—'}
            </p>
            <p className="text-xs font-semibold text-slate-600 mt-1.5">حجوزات ومبيعات</p>
            {perf && (
              <p className="text-2xs text-violet-600 mt-1 font-semibold">
                {perf.contractsSigned} عقد موقّع
              </p>
            )}
            {perf && perf.reservationsCreated > 0 && (
              <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-400 transition-all"
                  style={{ width: `${Math.min(Math.round((perf.contractsSigned / perf.reservationsCreated) * 100), 100)}%` }}
                />
              </div>
            )}
          </div>
        </Link>

        {/* Net commissions */}
        <Link href="/portal/commissions" className="block group">
          <div className="h-full rounded-2xl bg-white border border-hairline shadow-xs p-4 group-hover:border-amber-200 group-hover:shadow-card transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center shrink-0">
                <BadgePercent className="h-4 w-4 text-amber-600" />
              </div>
              {perf && Number(perf.commissionsNet) > 0 && (
                <span className="text-2xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full tabular-nums">
                  {Math.min(Math.round((Number(perf.payoutsTotalNet) / Number(perf.commissionsNet)) * 100), 100)}% مُصرَف
                </span>
              )}
            </div>
            <p className="text-xl font-extrabold text-amber-700 tabular-nums leading-snug">
              {perf ? formatCompact(perf.commissionsNet) : '—'}
            </p>
            <p className="text-xs font-semibold text-slate-600 mt-1.5">صافي عمولاتي</p>
            {perf && (
              <p className="text-2xs text-teal-600 mt-1 font-semibold">
                {formatCompact(perf.payoutsTotalNet)} مدفوع
              </p>
            )}
            {perf && Number(perf.commissionsNet) > 0 && (
              <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(Math.round((Number(perf.payoutsTotalNet) / Number(perf.commissionsNet)) * 100), 100)}%` }}
                />
              </div>
            )}
          </div>
        </Link>

        {/* Actions needed */}
        <div className={cn(
          'h-full rounded-2xl border shadow-xs p-4 transition-all',
          totalActions > 0
            ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50/40 border-emerald-100',
        )}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
              totalActions > 0
                ? 'bg-amber-100 ring-1 ring-amber-200'
                : 'bg-emerald-50 ring-1 ring-emerald-200',
            )}>
              {totalActions > 0
                ? <Bell className="h-4 w-4 text-amber-600 animate-pulse" />
                : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              }
            </div>
            {totalActions > 0 && (
              <span className="text-2xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                يحتاج اهتمام
              </span>
            )}
          </div>
          <p className={cn(
            'text-3xl font-extrabold tabular-nums leading-none',
            totalActions > 0 ? 'text-amber-700' : 'text-emerald-600',
          )}>
            {totalActions}
          </p>
          <p className="text-xs font-semibold text-slate-600 mt-1.5">
            {totalActions > 0 ? 'تحتاج متابعة' : 'لا مهام معلقة'}
          </p>
          {totalActions > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {pendingLeadsCount > 0 && (
                <span className="text-2xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  {pendingLeadsCount} فرصة
                </span>
              )}
              {newVisitsCount > 0 && (
                <span className="text-2xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {newVisitsCount} زيارة
                </span>
              )}
              {approvedPayoutsCount > 0 && (
                <span className="text-2xs font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
                  {approvedPayoutsCount} دفعة
                </span>
              )}
            </div>
          ) : (
            <p className="text-2xs text-emerald-600 mt-1 font-semibold">كل المهام مكتملة</p>
          )}
        </div>
      </div>

      {/* ── 3. Follow-ups + Pipeline ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Follow-up tasks */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
              totalActions > 0 ? 'bg-amber-100' : 'bg-slate-100',
            )}>
              <Bell className={cn('h-3.5 w-3.5', totalActions > 0 ? 'text-amber-600' : 'text-slate-400')} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">مهام متابعة</h2>
            {totalActions > 0 && (
              <span className="inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-amber-500 text-white text-2xs font-extrabold">
                {totalActions}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {([
              {
                href: '/portal/leads?status=PENDING',
                Icon: UserPlus,
                label: 'فرص قيد المراجعة',
                sub: 'تنتظر قرار اعتماد أو رفض من الإدارة',
                count: pendingLeadsCount,
                active: pendingLeadsCount > 0,
                borderColor: 'border-amber-400',
                iconBg: 'bg-amber-100',
                iconText: 'text-amber-600',
                rowBg: 'bg-amber-50/70',
                badgeBg: 'bg-amber-500 text-white',
              },
              {
                href: '/portal/visits?requestStatus=NEW',
                Icon: CalendarClock,
                label: 'طلبات زيارة جديدة',
                sub: 'بانتظار تجدول موعد من الإدارة',
                count: newVisitsCount,
                active: newVisitsCount > 0,
                borderColor: 'border-blue-400',
                iconBg: 'bg-blue-100',
                iconText: 'text-blue-600',
                rowBg: 'bg-blue-50/70',
                badgeBg: 'bg-blue-500 text-white',
              },
              {
                href: '/portal/payouts?status=APPROVED',
                Icon: Wallet,
                label: 'دفعات معتمدة',
                sub: 'معتمدة وبانتظار الصرف الفعلي',
                count: approvedPayoutsCount,
                active: approvedPayoutsCount > 0,
                borderColor: 'border-teal-400',
                iconBg: 'bg-teal-100',
                iconText: 'text-teal-600',
                rowBg: 'bg-teal-50/70',
                badgeBg: 'bg-teal-500 text-white',
              },
              {
                href: '/portal/units?status=AVAILABLE',
                Icon: Home,
                label: 'وحدات متاحة للتسويق',
                sub: 'جاهزة للعرض على العملاء',
                count: availableCount,
                active: availableCount > 0,
                borderColor: 'border-emerald-400',
                iconBg: 'bg-emerald-100',
                iconText: 'text-emerald-600',
                rowBg: 'bg-emerald-50/50',
                badgeBg: 'bg-emerald-500 text-white',
              },
            ] as const).map((item) => (
              <Link
                key={item.href}
                href={item.href as never}
                className={cn(
                  'flex items-center gap-3 ps-3 pe-3 py-2.5 rounded-xl transition-all border-s-2',
                  item.active
                    ? cn(item.borderColor, item.rowBg)
                    : 'border-transparent bg-slate-50/60 hover:bg-slate-100/60',
                )}
              >
                <div className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                  item.active ? item.iconBg : 'bg-slate-100',
                )}>
                  <item.Icon className={cn(
                    'h-3.5 w-3.5',
                    item.active ? item.iconText : 'text-slate-300',
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-bold',
                    item.active ? 'text-slate-900' : 'text-slate-400',
                  )}>
                    {item.label}
                  </p>
                  <p className="text-2xs text-slate-400 mt-0.5 leading-tight">{item.sub}</p>
                </div>
                <span className={cn(
                  'text-xs font-extrabold px-2 py-0.5 rounded-full shrink-0 tabular-nums min-w-[28px] text-center',
                  item.active ? item.badgeBg : 'text-slate-300',
                )}>
                  {item.count}
                </span>
                <ChevronLeft className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  item.active ? 'text-slate-400' : 'text-slate-200',
                )} />
              </Link>
            ))}
          </div>
        </Card>

        {/* Sales pipeline */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">مسار المبيعات</h2>
            </div>
            <Link
              href="/portal/performance"
              className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
            >
              تفاصيل
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {pipeline.length > 0 ? (
            <div className="space-y-1.5">
              {pipeline.map((stage) => {
                const widthPct = Math.max(Math.round((stage.value / pipelineMax) * 100), 4);
                const Icon     = stage.Icon;
                return (
                  <div key={stage.label}>
                    {stage.convRate && (
                      <div className="flex items-center gap-2 ps-10 my-0.5">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="inline-flex items-center gap-0.5 text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0">
                          <ChevronLeft className="h-2.5 w-2.5 rotate-90" />
                          {stage.convRate}
                        </span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', stage.iconBg)}>
                        <Icon className={cn('h-3.5 w-3.5', stage.iconText)} />
                      </div>
                      <div className="flex-1 h-8 rounded-xl bg-slate-100 overflow-hidden relative">
                        <div
                          className={cn('h-full rounded-xl transition-all duration-500', stage.bar)}
                          style={{ width: `${widthPct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-3 text-xs font-extrabold tabular-nums text-slate-800">
                          {stage.value.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-2xs font-semibold text-slate-500 w-[72px] text-end leading-tight shrink-0">
                        {stage.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <TrendingUp className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد بيانات أداء بعد.</p>
            </div>
          )}

          {perf && (
            <div className="mt-4 pt-3 border-t border-hairline grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 border border-hairline px-3 py-2.5">
                <p className="text-2xs text-slate-400 font-medium">حجم المبيعات</p>
                <p className="text-xs font-extrabold text-slate-900 tabular-nums mt-0.5">
                  {formatCompact(perf.salesGross)}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                <p className="text-2xs text-amber-600 font-medium">صافي العمولات</p>
                <p className="text-xs font-extrabold text-amber-700 tabular-nums mt-0.5">
                  {formatCompact(perf.commissionsNet)}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── 4. Leads table + sidebar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Recent leads (8/12) */}
        <Card className="lg:col-span-8 p-0 overflow-hidden lg:self-start">
          <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <UserPlus className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">آخر الفرص المُرسلة</h2>
              {leadsRes.data?.meta.total != null && (
                <span className="text-2xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                  {leadsRes.data.meta.total} إجمالي
                </span>
              )}
            </div>
            <Link
              href="/portal/leads"
              className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
            >
              عرض الكل
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <EmptyState
              icon={<UserPlus />}
              title="لا توجد فرص بعد"
              description="ابدأ بإضافة أول فرصة من زر «فرصة جديدة» أعلى الصفحة."
              action={
                <Link href="/portal/leads/new">
                  <Button variant="primary" size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
                    فرصة جديدة
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-2xs font-bold uppercase tracking-wider text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="text-start py-3 ps-5 pe-3">العميل</th>
                    <th className="text-start py-3 px-3">المشروع</th>
                    <th className="text-start py-3 px-3">الحالة</th>
                    <th className="text-start py-3 px-3 hidden md:table-cell">الإرسال</th>
                    <th className="py-3 ps-3 pe-5 w-px" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-surface-muted/40 transition-colors align-middle"
                    >
                      <td className="py-3 ps-5 pe-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0',
                            avatarColor(lead.fullName),
                          )}>
                            {initials(lead.fullName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{lead.fullName}</p>
                            {lead.phone && (
                              <p className="text-2xs text-slate-400 tabular-nums mt-0.5" dir="ltr">
                                {lead.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {lead.projectInterest ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-700 truncate">
                              {tx(lead.projectInterest.name)}
                            </p>
                            <p className="text-2xs text-slate-400 mt-0.5">{lead.projectInterest.city}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {lead.brokerApprovalStatus ? (
                          <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />
                        ) : (
                          <span className="inline-flex items-center text-2xs font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                            جديد
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-2xs text-slate-400 whitespace-nowrap hidden md:table-cell tabular-nums">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="py-3 ps-3 pe-5">
                        <Link href={`/portal/leads/${lead.id}` as never}>
                          <Button variant="ghost" size="sm">عرض</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Sidebar (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:self-start">

          {/* Quick actions */}
          <Card className="p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">إجراءات سريعة</h2>
            <Link href="/portal/leads/new" className="block">
              <Button variant="primary" size="md" leftIcon={<UserPlus className="h-4 w-4" />} fullWidth>
                إضافة فرصة جديدة
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Link href="/portal/visits/new">
                <Button variant="outline" size="sm" leftIcon={<CalendarClock className="h-3.5 w-3.5" />} fullWidth>
                  طلب زيارة
                </Button>
              </Link>
              <Link href="/portal/reservations/new">
                <Button variant="outline" size="sm" leftIcon={<BookmarkCheck className="h-3.5 w-3.5" />} fullWidth>
                  حجز جديد
                </Button>
              </Link>
            </div>
            <div className="border-t border-hairline mt-3 pt-3 grid grid-cols-3 gap-1.5">
              {([
                { href: '/portal/projects',   Icon: Building2,    label: 'المشاريع'  },
                { href: '/portal/units',       Icon: Home,         label: 'الوحدات'   },
                { href: '/portal/leads',       Icon: UserPlus,     label: 'الفرص'     },
                { href: '/portal/commissions', Icon: BadgePercent, label: 'العمولات'  },
                { href: '/portal/payouts',     Icon: Wallet,       label: 'المدفوعات' },
                { href: '/portal/performance', Icon: TrendingUp,   label: 'الأداء'    },
              ] as const).map(({ href, Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  <span className="text-2xs font-medium text-slate-500 group-hover:text-brand-700 transition-colors text-center leading-tight">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Available projects (compact list) */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <Building2 className="h-3 w-3 text-brand-600" />
                </div>
                <h2 className="text-xs font-bold text-slate-900">المشاريع المتاحة</h2>
                <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
                  {projects.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {availableCount > 0 && (
                  <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                    {availableCount} متاحة
                  </span>
                )}
                <Link href="/portal/projects" className="text-2xs text-brand-700 hover:text-brand-800 font-bold">
                  الكل
                </Link>
              </div>
            </div>

            {projects.length === 0 ? (
              <p className="px-5 py-4 text-xs text-slate-400">لا توجد مشاريع مسموح بها بعد.</p>
            ) : (
              <div className="divide-y divide-hairline">
                {projects.slice(0, 5).map((p) => {
                  const cover = p.project.media?.[0]?.url;
                  return (
                    <div
                      key={p.project.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
                    >
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={tx(p.project.name)}
                          className="h-9 w-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-9 w-12 rounded-lg bg-gradient-to-br from-amber-50 to-brand-50 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-amber-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{tx(p.project.name)}</p>
                        <p className="text-2xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          {p.project.city}
                          {p.access.commissionPct != null && (
                            <span className="text-amber-600 font-extrabold shrink-0">
                              · {Number(p.access.commissionPct).toFixed(1)}%
                            </span>
                          )}
                        </p>
                      </div>
                      <Link href={`/portal/units?projectId=${p.project.id}` as never} className="shrink-0">
                        <Button variant="ghost" size="sm">وحدات</Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── 5. Activity feed ─────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">أحدث النشاط</h2>
            </div>
            <Link
              href="/portal/activity"
              className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
            >
              عرض الكل
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* gap-px + bg-hairline creates 1px grid lines between cells */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline">
            {activity.slice(0, 6).map((item) => {
              const meta = ACTIVITY_META[item.type];
              const linkHref =
                item.entityType === 'VisitRequest'  ? '/portal/visits'
                : item.entityType === 'Reservation' ? `/portal/reservations/${item.entityId}`
                : item.entityType === 'Contract'    ? `/portal/contracts/${item.entityId}`
                : item.entityType === 'Commission'  ? `/portal/commissions/${item.entityId}`
                : item.entityType === 'Payout'      ? `/portal/payouts/${item.entityId}`
                : item.lead                         ? `/portal/leads/${item.lead.id}`
                : '/portal/activity';

              const subtitle = item.lead
                ? [item.lead.fullName, item.lead.projectInterest ? tx(item.lead.projectInterest.name) : null]
                    .filter(Boolean)
                    .join(' · ')
                : 'على مستوى شركة الوساطة';

              return (
                <Link
                  key={item.id}
                  href={linkHref as never}
                  className="flex items-center gap-3 bg-white px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl shrink-0', meta.color)}>
                    <ActivityIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-bold text-slate-900 leading-snug truncate">{meta.label}</p>
                      <time
                        className="text-2xs text-slate-500 tabular-nums whitespace-nowrap shrink-0"
                        dir="ltr"
                      >
                        {formatDateTime(item.createdAt)}
                      </time>
                    </div>
                    <p className="text-2xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
