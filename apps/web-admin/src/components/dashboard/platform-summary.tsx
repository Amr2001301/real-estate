import { Fragment } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  BadgeCheck,
  AlertTriangle,
  Coins,
  Users,
  CalendarCheck2,
  BookmarkCheck,
  FileText,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';
import { Card } from '@/components/ui/card';

interface Kpis {
  projects:        number;
  availableUnits:  number;
  reservedUnits:   number;
  soldUnits:       number;
  signedContracts: number;
  totalCustomers:  number;
  totalTeam:       number;
}

interface Financial {
  totalContractValue:     number;
  totalCollectedVerified: number;
  overdueTotal:           number;
  pendingBonus:           number;
  pendingBrokerPayouts:   number;
}

interface Funnel {
  leads:        number;
  visits:       number;
  reservations: number;
  contracts:    number;
}

interface Props {
  kpis:       Kpis;
  financial?: Financial;
  funnel?:    Funnel;
}

function convPct(num: number, denom: number): string | null {
  if (denom <= 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

export function PlatformSummaryCard({ kpis, financial, funnel }: Props) {
  const hasFin    = financial != null;
  const hasFunnel = funnel != null && funnel.leads > 0;

  // ── Financial derived ──────────────────────────────────────────────────────
  const collectionRate = hasFin && financial.totalContractValue > 0
    ? Math.round((financial.totalCollectedVerified / financial.totalContractValue) * 100)
    : null;
  const pendingLiabilities = hasFin ? financial.pendingBonus + financial.pendingBrokerPayouts : 0;

  // ── Business metrics strip ─────────────────────────────────────────────────
  const businessMetrics: Array<{ label: string; value: number; sub?: string }> = [
    { label: 'مشاريع',      value: kpis.projects       },
    { label: 'وحدات متاحة', value: kpis.availableUnits, sub: `محجوز ${kpis.reservedUnits} · مباع ${kpis.soldUnits}` },
    { label: 'عقود موقعة',  value: kpis.signedContracts },
    { label: 'العملاء',     value: kpis.totalCustomers  },
    { label: 'الفريق',      value: kpis.totalTeam       },
  ];

  // ── Financial items ────────────────────────────────────────────────────────
  interface FinItem { label: string; value: string; sub?: string; icon: React.ReactNode; iconCn: string; valueCn: string; }
  const finItems: FinItem[] = hasFin ? [
    {
      label:   'إجمالي قيمة العقود',
      value:   formatCompact(financial.totalContractValue),
      sub:     'قيمة العقود المُبرمة',
      icon:    <TrendingUp />,
      iconCn:  'bg-brand-50 text-brand-600',
      valueCn: 'text-slate-900',
    },
    {
      label:   'المحصّل المؤكد',
      value:   formatCompact(financial.totalCollectedVerified),
      sub:     collectionRate !== null ? `${collectionRate}% تحصيل` : undefined,
      icon:    <BadgeCheck />,
      iconCn:  'bg-success-50 text-success-600',
      valueCn: 'text-success-700',
    },
    {
      label:   'مبالغ متأخرة',
      value:   formatCompact(financial.overdueTotal),
      sub:     financial.overdueTotal > 0 ? 'تجاوزت الاستحقاق' : 'لا مبالغ متأخرة',
      icon:    <AlertTriangle />,
      iconCn:  financial.overdueTotal > 0 ? 'bg-danger-50 text-danger-600' : 'bg-slate-50 text-slate-400',
      valueCn: financial.overdueTotal > 0 ? 'text-danger-700' : 'text-slate-400',
    },
    {
      label:   'التزامات معلقة',
      value:   formatCompact(pendingLiabilities),
      sub:     'عمولات + مكافآت',
      icon:    <Coins />,
      iconCn:  pendingLiabilities > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400',
      valueCn: pendingLiabilities > 0 ? 'text-amber-700' : 'text-slate-400',
    },
  ] : [];

  // ── Funnel stages ──────────────────────────────────────────────────────────
  const funnelStages = hasFunnel ? [
    { key: 'leads',        label: 'فرص المبيعات',  value: funnel!.leads,        icon: <Users />,          iconBg: 'bg-purple-50 text-purple-600',   bar: 'bg-purple-400'   },
    { key: 'visits',       label: 'الزيارات',       value: funnel!.visits,       icon: <CalendarCheck2 />, iconBg: 'bg-info-50 text-info-600',       bar: 'bg-info-400'     },
    { key: 'reservations', label: 'الحجوزات',       value: funnel!.reservations, icon: <BookmarkCheck />,  iconBg: 'bg-brand-50 text-brand-600',     bar: 'bg-brand-400'    },
    { key: 'contracts',    label: 'العقود الموقعة', value: funnel!.contracts,    icon: <FileText />,       iconBg: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400'  },
  ] : [];

  const funnelMax  = Math.max(...funnelStages.map((s) => s.value), 1);
  const convRates  = hasFunnel ? [
    convPct(funnel!.visits,       funnel!.leads),
    convPct(funnel!.reservations, funnel!.visits),
    convPct(funnel!.contracts,    funnel!.reservations),
  ] : [];

  return (
    <Card className="p-0 overflow-hidden">

      {/* ── Card header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hairline bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-none">ملخص المنصة</h2>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
              نظرة مركزة على حالة الأعمال، الماليات، ومسار التحويل
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-success-50 border border-success-100 text-success-700 text-[9px] font-semibold shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-success-400 animate-pulse shrink-0" />
          بيانات حية
        </span>
      </div>

      {/* ── Zone A: Business metrics ─────────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-hairline">
        {businessMetrics.map((m, i) => (
          <div
            key={m.label}
            className={cn(
              'flex-1 flex flex-col items-center justify-center px-4 py-5 text-center min-w-0 bg-white',
              i > 0 && 'border-s border-hairline',
            )}
          >
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
              {m.value}
            </p>
            {m.sub && (
              <p className="text-[9px] text-slate-400 mt-1 leading-none truncate max-w-full">
                {m.sub}
              </p>
            )}
            <p className="text-[10px] text-slate-400 font-semibold mt-1.5 leading-none">
              {m.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Zone B: Financial snapshot ───────────────────────────────────────── */}
      {hasFin && (
        <div className="flex items-stretch border-b border-hairline overflow-x-auto">
          {finItems.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                'flex-1 min-w-[130px] px-5 py-4 bg-white',
                i > 0 && 'border-s border-hairline',
              )}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-lg [&_svg]:h-3 [&_svg]:w-3 shrink-0',
                    f.iconCn,
                  )}
                >
                  {f.icon}
                </span>
                <p className="text-[10px] text-slate-500 font-semibold leading-none truncate">
                  {f.label}
                </p>
              </div>
              <p className={cn('text-base font-extrabold tabular-nums leading-none', f.valueCn)}>
                {f.value}
              </p>
              {f.sub && (
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{f.sub}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Zone C: Conversion pipeline ──────────────────────────────────────── */}
      {hasFunnel && (
        <div className="flex items-center px-5 py-4">
          {funnelStages.map((stage, i) => (
            <Fragment key={stage.key}>
              <div className="flex-1 flex flex-col items-center text-center">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5 mb-1.5',
                    stage.iconBg,
                  )}
                >
                  {stage.icon}
                </span>
                <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">
                  {stage.value.toLocaleString('ar-SA')}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-none">
                  {stage.label}
                </p>
                <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', stage.bar)}
                    style={{ width: `${Math.round((stage.value / funnelMax) * 100)}%` }}
                  />
                </div>
              </div>

              {i < funnelStages.length - 1 && (
                <div className="flex flex-col items-center gap-0.5 px-2 shrink-0 mb-3">
                  {convRates[i] && (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums">
                      {convRates[i]}
                    </span>
                  )}
                  <ChevronLeft className="h-3 w-3 text-slate-300" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

    </Card>
  );
}
