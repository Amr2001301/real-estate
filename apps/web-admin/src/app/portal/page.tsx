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
import type { ReactNode } from 'react';
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
import { tx, formatDate, formatDateTime, formatCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerStatusBadge, BrokerLeadStatusBadge } from '@/components/badges';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Helpers ───────────────────────────────────────────────────────────────────

type PerfSummary = PortalPerformanceResponse['summary'];

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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── Activity meta ─────────────────────────────────────────────────────────────

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

// ── Broker KPI Strip ──────────────────────────────────────────────────────────

function BrokerKpiStrip({ perf }: { perf: PerfSummary | undefined }) {
  const submitted      = perf?.leadsSubmitted      ?? 0;
  const approved       = perf?.leadsApproved       ?? 0;
  const reservations   = perf?.reservationsCreated ?? 0;
  const contracts      = perf?.contractsSigned     ?? 0;
  const commissionsNet = Number(perf?.commissionsNet  ?? 0);
  const payoutsNet     = Number(perf?.payoutsTotalNet ?? 0);
  const salesGross     = Number(perf?.salesGross      ?? 0);

  const approvalRate = submitted    > 0 ? Math.round((approved   / submitted)    * 100) : null;
  const closingRate  = reservations > 0 ? Math.round((contracts  / reservations) * 100) : null;
  const payoutRate   = commissionsNet > 0 ? Math.round((payoutsNet / commissionsNet) * 100) : null;

  const tiles = [
    {
      label:    'فرص مُرسلة',
      value:    perf ? String(submitted) : '—',
      sub:      approvalRate !== null
                  ? `${approved} معتمدة · ${approvalRate}% قبول`
                  : 'لا فرص مُرسلة بعد',
      valueCls: 'text-brand-700',
    },
    {
      label:    'عقود موقّعة',
      value:    perf ? String(contracts) : '—',
      sub:      closingRate !== null
                  ? `${reservations} حجوزات · ${closingRate}% إغلاق`
                  : 'لا عقود بعد',
      valueCls: 'text-emerald-700',
    },
    {
      label:    'حجم المبيعات',
      value:    perf ? formatCompact(salesGross) : '—',
      sub:      'إجمالي قيمة العقود',
      valueCls: 'text-slate-900',
    },
    {
      label:    'عمولاتي',
      value:    perf ? formatCompact(commissionsNet) : '—',
      sub:      payoutRate !== null
                  ? `${formatCompact(payoutsNet)} مُصرَف · ${payoutRate}%`
                  : 'لا عمولات بعد',
      valueCls: 'text-amber-700',
    },
    {
      label:    'نسبة الصرف',
      value:    payoutRate !== null ? `${payoutRate}%` : '—',
      sub:      payoutRate === null   ? '—'                    :
                payoutRate >= 80      ? 'مُصرَف بالكامل تقريباً' :
                payoutRate >= 50      ? 'جزئياً مُصرَف'          :
                                        'قيد المعالجة',
      valueCls: payoutRate === null   ? 'text-slate-400'   :
                payoutRate >= 80      ? 'text-success-700'  :
                payoutRate >= 50      ? 'text-brand-600'    :
                                        'text-amber-600',
    },
  ];

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-hairline">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface px-5 py-5">
            <p className="text-[11px] font-medium text-slate-400 mb-2 leading-none">{tile.label}</p>
            <p className={cn('text-[22px] font-black tabular-nums leading-none tracking-tight', tile.valueCls)}>
              {tile.value}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 leading-none">{tile.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Broker Action Queue ───────────────────────────────────────────────────────

function BrokerActionQueue({
  pendingLeads, newVisits, approvedPayouts, availableUnits,
}: {
  pendingLeads:    number;
  newVisits:       number;
  approvedPayouts: number;
  availableUnits:  number;
}) {
  const actionTotal = pendingLeads + newVisits + approvedPayouts;

  const slots = [
    {
      key: 'leads', label: 'فرص قيد المراجعة', description: 'بانتظار قرار من الإدارة',
      value: pendingLeads, href: '/portal/leads?status=PENDING' as const,
      icon: <UserPlus />,
      iconCls:  pendingLeads > 0 ? 'bg-amber-50 text-amber-600'       : 'bg-slate-50 text-slate-300',
      countCls: pendingLeads > 0 ? 'text-amber-700'                   : 'text-slate-200',
      dotCls:   'bg-amber-500',
    },
    {
      key: 'visits', label: 'طلبات زيارة جديدة', description: 'بانتظار جدولة موعد',
      value: newVisits, href: '/portal/visits?requestStatus=NEW' as const,
      icon: <CalendarClock />,
      iconCls:  newVisits > 0 ? 'bg-blue-50 text-blue-600'           : 'bg-slate-50 text-slate-300',
      countCls: newVisits > 0 ? 'text-blue-700'                      : 'text-slate-200',
      dotCls:  'bg-blue-500',
    },
    {
      key: 'payouts', label: 'دفعات جاهزة للصرف', description: 'معتمدة وبانتظار التحويل',
      value: approvedPayouts, href: '/portal/payouts?status=APPROVED' as const,
      icon: <Wallet />,
      iconCls:  approvedPayouts > 0 ? 'bg-teal-50 text-teal-600'     : 'bg-slate-50 text-slate-300',
      countCls: approvedPayouts > 0 ? 'text-teal-700'                : 'text-slate-200',
      dotCls:   'bg-teal-500',
    },
    {
      key: 'units', label: 'وحدات للتسويق', description: 'جاهزة للعرض على العملاء',
      value: availableUnits, href: '/portal/units?status=AVAILABLE' as const,
      icon: <Home />,
      iconCls:  availableUnits > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300',
      countCls: availableUnits > 0 ? 'text-emerald-700'               : 'text-slate-200',
      dotCls:   'bg-emerald-500',
    },
  ];

  if (actionTotal === 0 && availableUnits === 0) {
    return (
      <div className="flex items-center gap-3 bg-success-50 border border-success-100 rounded-2xl px-5 py-4">
        <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-success-800">لا توجد مهام معلقة</p>
          <p className="text-xs text-success-600 mt-0.5">كل الإجراءات مكتملة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline bg-canvas/50">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Bell className="h-4 w-4 text-slate-600" />
            {actionTotal > 0 && (
              <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </div>
          <p className="text-[13px] font-bold text-slate-800">متابعة وفرص</p>
          {actionTotal > 0 && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
              {actionTotal} معلق
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 hidden sm:block">انقر على أي بند للانتقال مباشرةً</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-hairline">
        {slots.map((slot) => {
          const active = slot.value > 0;
          return (
            <Link key={slot.key} href={slot.href as never} className="group block">
              <div className={cn(
                'bg-surface h-full px-4 py-5 flex flex-col justify-between gap-4 transition-colors duration-150',
                active && 'hover:bg-slate-50/80',
              )}>
                <div className="flex items-center justify-between">
                  <div className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0',
                    slot.iconCls,
                  )}>
                    {slot.icon}
                  </div>
                  {active && (
                    <span className={cn('h-2 w-2 rounded-full animate-pulse shrink-0', slot.dotCls)} />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className={cn('text-[30px] font-black tabular-nums leading-none tracking-tight', slot.countCls)}>
                    {slot.value}
                  </p>
                  <p className={cn('text-[11px] font-bold leading-snug', active ? 'text-slate-800' : 'text-slate-300')}>
                    {slot.label}
                  </p>
                  {active && (
                    <p className="text-[10px] text-slate-400 leading-tight">{slot.description}</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Sales Funnel Card ─────────────────────────────────────────────────────────

interface FunnelStage {
  Icon:      React.ComponentType<{ className?: string }>;
  label:     string;
  value:     number;
  iconBg:    string;
  iconText:  string;
  valueCls:  string;
  convRate:  string | null;
}

function SalesFunnelCard({
  pipeline,
  perf,
}: {
  pipeline: FunnelStage[];
  perf:     PerfSummary | undefined;
}) {
  if (pipeline.length === 0) {
    return (
      <div className="bg-surface border border-hairline rounded-[20px] p-10 shadow-soft flex flex-col items-center gap-3">
        <TrendingUp className="h-10 w-10 text-slate-200" />
        <p className="text-sm text-slate-400">لا توجد بيانات أداء بعد.</p>
        <p className="text-xs text-slate-300">ابدأ بإرسال فرصتك الأولى لتظهر هنا.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-hairline rounded-[20px] p-6 shadow-soft">

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">مسار التحويل البيعي</h2>
        </div>
        <Link
          href="/portal/performance"
          className="flex items-center gap-1 text-[11px] text-brand-700 hover:text-brand-800 font-bold transition-colors"
        >
          تفاصيل الأداء
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Horizontal funnel: stage blocks + conversion connectors */}
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        {pipeline.map((stage, i) => {
          const Icon   = stage.Icon;
          const isLast = i === pipeline.length - 1;

          return (
            <div key={stage.label} className="contents">

              {/* Stage block */}
              <div className="flex-1 flex flex-col items-center gap-3 bg-canvas/60 border border-hairline rounded-2xl px-2 sm:px-3 py-4">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', stage.iconBg)}>
                  <Icon className={cn('h-4 w-4', stage.iconText)} />
                </div>
                <p className={cn('text-[22px] sm:text-[26px] font-black tabular-nums leading-none tracking-tight', stage.valueCls)}>
                  {stage.value}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 text-center leading-tight">
                  {stage.label}
                </p>
              </div>

              {/* Conversion connector */}
              {!isLast && (
                <div className="flex flex-col items-center justify-center gap-1 w-5 sm:w-8 shrink-0">
                  {stage.convRate && (
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 leading-none whitespace-nowrap">
                      {stage.convRate}
                    </span>
                  )}
                  <ChevronLeft className="h-3 w-3 text-slate-300" />
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Bottom: conversion rate stats */}
      {perf && (
        <div className="mt-5 pt-4 border-t border-hairline grid grid-cols-3 gap-2">
          {([
            { label: 'معدل القبول',         value: convPct(perf.leadsApproved, perf.leadsSubmitted)           ?? '—', cls: 'text-blue-700'    },
            { label: 'معدل التعاقد',         value: convPct(perf.contractsSigned, perf.reservationsCreated)   ?? '—', cls: 'text-emerald-700' },
            { label: 'معدل صرف العمولات',   value: convPct(perf.payoutsPaid, perf.contractsSigned)            ?? '—', cls: 'text-teal-700'    },
          ] as const).map((s) => (
            <div key={s.label} className="text-center bg-canvas/60 border border-hairline rounded-xl py-3">
              <p className={cn('text-[20px] font-black tabular-nums leading-none', s.cls)}>{s.value}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const hasContract          = !!(me.broker.contractStartAt && me.broker.contractEndAt);

  const pipeline: FunnelStage[] = perf
    ? [
        { Icon: UserPlus,         label: 'فرص مُرسلة',  value: perf.leadsSubmitted,       iconBg: 'bg-brand-50',   iconText: 'text-brand-600',   valueCls: 'text-brand-700',   convRate: null },
        { Icon: ShieldCheck,      label: 'فرص معتمدة',  value: perf.leadsApproved,        iconBg: 'bg-blue-50',    iconText: 'text-blue-600',    valueCls: 'text-blue-700',    convRate: convPct(perf.leadsApproved, perf.leadsSubmitted) },
        { Icon: BookmarkCheck,    label: 'حجوزات',       value: perf.reservationsCreated,  iconBg: 'bg-violet-50',  iconText: 'text-violet-600',  valueCls: 'text-violet-700',  convRate: convPct(perf.reservationsCreated, perf.leadsApproved) },
        { Icon: FilePen,          label: 'عقود موقّعة', value: perf.contractsSigned,      iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', valueCls: 'text-emerald-700', convRate: convPct(perf.contractsSigned, perf.reservationsCreated) },
        { Icon: CircleDollarSign, label: 'مدفوعات',      value: perf.payoutsPaid,          iconBg: 'bg-teal-50',    iconText: 'text-teal-600',    valueCls: 'text-teal-700',    convRate: convPct(perf.payoutsPaid, perf.contractsSigned) },
      ]
    : [];

  return (
    <div className="space-y-5">

      {/* ── 1. Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-[20px] bg-surface border border-hairline shadow-soft px-5 py-4">
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

      {/* ── 2. KPI Strip ─────────────────────────────────────────────────────── */}
      <BrokerKpiStrip perf={perf} />

      {/* ── 3. Action Queue ──────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>متابعة وفرص</SectionLabel>
        <BrokerActionQueue
          pendingLeads={pendingLeadsCount}
          newVisits={newVisitsCount}
          approvedPayouts={approvedPayoutsCount}
          availableUnits={availableCount}
        />
      </div>

      {/* ── 4. Sales Funnel ──────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>تحليل الأداء</SectionLabel>
        <SalesFunnelCard pipeline={pipeline} perf={perf} />
      </div>

      {/* ── 5. Leads table + Sidebar ─────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>الفرص والمشاريع</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-4">

          {/* Recent leads */}
          <div className="lg:col-span-8 bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-canvas/40">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <UserPlus className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">آخر الفرص المُرسلة</h2>
                {leadsRes.data?.meta.total != null && (
                  <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
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
                  <thead className="bg-canvas/40 text-2xs font-bold uppercase tracking-wider text-slate-400 border-b border-hairline">
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
                      <tr key={lead.id} className="hover:bg-canvas/40 transition-colors align-middle">
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
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* Quick actions */}
            <div className="bg-surface border border-hairline rounded-[20px] shadow-soft p-5">
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
                    className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl bg-canvas/60 hover:bg-brand-50 border border-hairline transition-colors group"
                  >
                    <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                    <span className="text-2xs font-medium text-slate-500 group-hover:text-brand-700 transition-colors text-center leading-tight">
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Available projects */}
            <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-canvas/40">
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
                  {projects.slice(0, 4).map((p) => {
                    const cover = p.project.media?.[0]?.url;
                    return (
                      <div
                        key={p.project.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/40 transition-colors"
                      >
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt={tx(p.project.name)} className="h-9 w-12 rounded-lg object-cover shrink-0" />
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
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Activity feed ─────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>آخر النشاطات</SectionLabel>
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-canvas/40">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline">
              {activity.slice(0, 6).map((item) => {
                const meta     = ACTIVITY_META[item.type];
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
                      .filter(Boolean).join(' · ')
                  : 'على مستوى شركة الوساطة';

                return (
                  <Link
                    key={item.id}
                    href={linkHref as never}
                    className="flex items-center gap-3 bg-surface px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                  >
                    <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl shrink-0', meta.color)}>
                      <ActivityIcon type={item.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-bold text-slate-900 leading-snug truncate">{meta.label}</p>
                        <time className="text-2xs text-slate-500 tabular-nums whitespace-nowrap shrink-0" dir="ltr">
                          {formatDateTime(item.createdAt)}
                        </time>
                      </div>
                      <p className="text-2xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
