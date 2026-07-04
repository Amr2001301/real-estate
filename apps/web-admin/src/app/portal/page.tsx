import Link from 'next/link';
import {
  Building2,
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
  PortalPerformanceResponse,
  PortalProject,
  PortalUnit,
} from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCompact } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
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

function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-[5px] w-[5px] rounded-full bg-brand-400/80 shrink-0" />
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap">
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

function BrokerKpiStrip({ perf, symbol }: { perf: PerfSummary | undefined; symbol?: string }) {
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
      topBar:   'from-brand-300 via-brand-500 to-brand-300',
      icon:     <UserPlus />,
      iconCls:  'bg-brand-50 text-brand-600 ring-1 ring-brand-100',
    },
    {
      label:    'عقود موقّعة',
      value:    perf ? String(contracts) : '—',
      sub:      closingRate !== null
                  ? `${reservations} حجوزات · ${closingRate}% إغلاق`
                  : 'لا عقود بعد',
      valueCls: 'text-emerald-700',
      topBar:   'from-emerald-300 via-emerald-500 to-emerald-300',
      icon:     <FilePen />,
      iconCls:  'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
    },
    {
      label:    'حجم المبيعات',
      value:    perf ? formatCompact(salesGross, symbol) : '—',
      sub:      'إجمالي قيمة العقود',
      valueCls: 'text-slate-900',
      topBar:   'from-slate-200 via-slate-400 to-slate-200',
      icon:     <TrendingUp />,
      iconCls:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    },
    {
      label:    'عمولاتي',
      value:    perf ? formatCompact(commissionsNet, symbol) : '—',
      sub:      payoutRate !== null
                  ? `${formatCompact(payoutsNet, symbol)} مُصرَف · ${payoutRate}%`
                  : 'لا عمولات بعد',
      valueCls: 'text-amber-700',
      topBar:   'from-amber-300 via-amber-500 to-amber-300',
      icon:     <BadgePercent />,
      iconCls:  'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
      featured: true,
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
      topBar:   payoutRate === null   ? 'from-slate-200 via-slate-300 to-slate-200' :
                payoutRate >= 80      ? 'from-success-300 via-success-500 to-success-300' :
                payoutRate >= 50      ? 'from-brand-300 via-brand-500 to-brand-300' :
                                        'from-amber-300 via-amber-500 to-amber-300',
      icon:     <Wallet />,
      iconCls:  payoutRate === null   ? 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'       :
                payoutRate >= 80      ? 'bg-success-50 text-success-600 ring-1 ring-success-100' :
                payoutRate >= 50      ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-100'       :
                                        'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiles.map((tile) => {
        const isLong = tile.value !== '—' && tile.value.length > 7;
        return (
          <div
            key={tile.label}
            className={cn(
              'relative flex flex-col overflow-hidden rounded-2xl border shadow-xs',
              tile.featured
                ? 'border-amber-200 bg-amber-50/30'
                : 'border-hairline bg-surface',
            )}
          >
            {/* Colored top bar */}
            <div className={cn('h-[3px] w-full shrink-0 bg-gradient-to-l', tile.topBar)} />
            <div className="flex flex-1 flex-col px-4 py-4">
              {/* Icon + label row */}
              <div className="flex items-start justify-between gap-2">
                <span className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[17px] [&_svg]:w-[17px]',
                  tile.iconCls,
                )}>
                  {tile.icon}
                </span>
                <p className="text-[11px] font-semibold text-slate-400 text-end leading-snug line-clamp-2">
                  {tile.label}
                </p>
              </div>
              {/* Value */}
              <p className={cn(
                'mt-3 font-black tabular-nums leading-none tracking-tight',
                isLong ? 'text-[19px]' : 'text-[26px]',
                tile.valueCls,
              )}>
                {tile.value}
              </p>
              {/* Sub */}
              <p className="mt-1.5 text-[10.5px] text-slate-400 leading-snug">{tile.sub}</p>
            </div>
          </div>
        );
      })}
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
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-navy leading-none">مسار التحويل البيعي</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">من الفرصة إلى المدفوعات</p>
          </div>
        </div>
        <Link
          href="/portal/performance"
          className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
        >
          تفاصيل الأداء
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Funnel stages */}
      <div className="p-5">
        <div className="flex items-stretch gap-2">
          {pipeline.map((stage, i) => {
            const Icon   = stage.Icon;
            const isLast = i === pipeline.length - 1;

            return (
              <div key={stage.label} className="contents">
                <div className="flex-1 flex flex-col items-center gap-2.5 bg-canvas/60 border border-hairline rounded-2xl px-2 py-4">
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

                {!isLast && (
                  <div className="flex flex-col items-center justify-center gap-1 w-6 shrink-0">
                    {stage.convRate && (
                      <span className="text-[9px] font-bold text-slate-400 leading-none whitespace-nowrap">
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

        {/* Bottom conversion rates */}
        {perf && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {([
              { label: 'معدل القبول',       value: convPct(perf.leadsApproved, perf.leadsSubmitted)        ?? '—', cls: 'text-blue-700'    },
              { label: 'معدل التعاقد',       value: convPct(perf.contractsSigned, perf.reservationsCreated) ?? '—', cls: 'text-emerald-700' },
              { label: 'معدل صرف العمولات', value: convPct(perf.payoutsPaid, perf.contractsSigned)         ?? '—', cls: 'text-teal-700'    },
            ] as const).map((s) => (
              <div key={s.label} className="text-center bg-canvas/60 border border-hairline rounded-xl py-3.5">
                <p className={cn('text-[22px] font-black tabular-nums leading-none', s.cls)}>{s.value}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PortalDashboard() {
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency);
  const [
    meRes, projectsRes, unitsRes, activityRes, perfRes, leadsRes,
  ] = await Promise.all([
    safe(api.get<PortalMe>('/portal/me')),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<Paged<PortalActivityItem>>('/portal/activity?pageSize=6')),
    safe(api.get<PortalPerformanceResponse>('/portal/performance')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?pageSize=5')),
  ]);

  if (meRes.error || !meRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات البوابة.
      </div>
    );
  }

  const me           = meRes.data;
  const projects     = projectsRes.data ?? [];
  const availableCount = unitsRes.data?.meta.total ?? 0;
  const activity     = activityRes.data?.data ?? [];
  const perf         = perfRes.data?.summary;
  const recentLeads  = leadsRes.data?.data ?? [];
  const hasContract  = !!(me.broker.contractStartAt && me.broker.contractEndAt);

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
      <div className="relative rounded-[20px] bg-surface border border-hairline shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-l from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Avatar + info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-md">
                <span className="text-white font-extrabold text-base tracking-wide">
                  {initials(me.user.fullName)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                {/* Name + status row */}
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold text-navy leading-tight">
                    أهلاً، {me.user.fullName}
                  </h1>
                  <BrokerStatusBadge status={me.broker.status} />
                  <span
                    className="font-mono text-2xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-hairline"
                    dir="ltr"
                  >
                    {me.broker.code}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  <span className="text-sm font-bold text-slate-700">{me.broker.companyName}</span>
                  <span className="text-slate-200 select-none hidden sm:inline">·</span>
                  <span className="inline-flex items-center gap-1">
                    <BadgePercent className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-sm font-extrabold text-amber-700 tabular-nums">
                      {Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}%
                    </span>
                    <span className="text-xs text-slate-400">عمولة</span>
                  </span>
                  {hasContract && (
                    <>
                      <span className="text-slate-200 select-none hidden sm:inline">·</span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500" dir="ltr">
                        <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="tabular-nums">
                          {formatDate(me.broker.contractStartAt)} – {formatDate(me.broker.contractEndAt)}
                        </span>
                      </span>
                    </>
                  )}
                  {me.permissions.isPrimaryContact && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-brand-100">
                      <CheckCircle2 className="h-3 w-3" />
                      جهة الاتصال الرئيسية
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CTA */}
            <Link href="/portal/leads/new" className="shrink-0">
              <Button variant="primary" size="md" leftIcon={<UserPlus className="h-4 w-4" />}>
                + فرصة جديدة
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. KPI Strip ─────────────────────────────────────────────────────── */}
      <BrokerKpiStrip perf={perf} symbol={symbol} />

      {/* ── 3. Leads table + Sidebar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-5">

        {/* Recent leads — 2/3 */}
        <div className="lg:col-span-2 bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline bg-canvas/30">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-brand-600" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-navy leading-none">آخر الفرص المُرسلة</h2>
                {leadsRes.data?.meta.total != null && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{leadsRes.data.meta.total} فرصة إجمالاً</p>
                )}
              </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-canvas/40">
                    <th className="text-start py-2.5 ps-5 pe-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">العميل</th>
                    <th className="text-start py-2.5 px-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">المشروع</th>
                    <th className="text-start py-2.5 px-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">الحالة</th>
                    <th className="text-start py-2.5 px-3 text-[11px] font-bold text-slate-500 whitespace-nowrap hidden md:table-cell">الإرسال</th>
                    <th className="py-2.5 ps-3 pe-5 w-px" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-canvas/40 transition-colors align-middle">
                      <td className="py-3.5 ps-5 pe-3">
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
                      <td className="py-3.5 px-3">
                        {lead.projectInterest ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-700 truncate">
                              {tx(lead.projectInterest.name)}
                            </p>
                            <p className="text-2xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              {lead.projectInterest.city}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {lead.brokerApprovalStatus ? (
                          <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />
                        ) : (
                          <span className="inline-flex items-center text-2xs font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                            جديد
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-2xs text-slate-400 whitespace-nowrap hidden md:table-cell tabular-nums">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="py-3.5 ps-3 pe-5">
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

        {/* Sidebar — 1/3: projects card fills full height */}
        <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline bg-canvas/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-navy leading-none">المشاريع المتاحة</h2>
                {availableCount > 0 && (
                  <p className="text-2xs text-emerald-600 font-semibold mt-0.5">{availableCount} وحدة متاحة</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {projects.length}
              </span>
              <Link href="/portal/projects" className="text-2xs text-brand-700 hover:text-brand-800 font-bold">
                الكل
              </Link>
            </div>
          </div>
          {projects.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400 text-center">لا توجد مشاريع مسموح بها بعد.</p>
          ) : (
            <div className="divide-y divide-hairline flex-1">
              {projects.map((p) => {
                const cover = p.project.media?.[0]?.url;
                return (
                  <div
                    key={p.project.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition-colors"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={tx(p.project.name)} className="h-10 w-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-14 rounded-lg bg-gradient-to-br from-amber-50 to-brand-50 border border-hairline flex items-center justify-center shrink-0">
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

      {/* ── 4. Sales Funnel ──────────────────────────────────────────────────── */}
      {pipeline.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>تحليل الأداء</SectionLabel>
          <SalesFunnelCard pipeline={pipeline} perf={perf} />
        </div>
      )}

      {/* ── 5. Activity feed ─────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>آخر النشاطات</SectionLabel>
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-hairline bg-canvas/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-navy leading-none">أحدث النشاط</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{activity.length} نشاط مسجّل</p>
                </div>
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
                    className="flex items-center gap-3 bg-surface px-5 py-4 hover:bg-canvas/40 transition-colors"
                  >
                    <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0', meta.color)}>
                      <ActivityIcon type={item.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-900 leading-snug truncate">{meta.label}</p>
                        <time className="text-2xs text-slate-400 tabular-nums whitespace-nowrap shrink-0" dir="ltr">
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
