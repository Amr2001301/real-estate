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
  projects:          number;
  availableUnits:    number;
  reservedUnits:     number;
  soldUnits:         number;
  signedContracts:   number;
  totalCustomers:    number;
  totalTeam:         number;
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

function pct(num: number, denom: number): string | null {
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

  const finItems = hasFin ? [
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
  ] as const : [];

  // ── Funnel derived ─────────────────────────────────────────────────────────
  const funnelStages = hasFunnel
    ? [
        { key: 'leads',        label: 'فرص المبيعات', value: funnel!.leads,        icon: <Users />,          iconBg: 'bg-purple-50 text-purple-600',   bar: 'bg-purple-400'   },
        { key: 'visits',       label: 'الزيارات',      value: funnel!.visits,       icon: <CalendarCheck2 />, iconBg: 'bg-info-50 text-info-600',       bar: 'bg-info-400'     },
        { key: 'reservations', label: 'الحجوزات',      value: funnel!.reservations, icon: <BookmarkCheck />,  iconBg: 'bg-brand-50 text-brand-600',     bar: 'bg-brand-400'    },
        { key: 'contracts',    label: 'العقود الموقعة', value: funnel!.contracts,   icon: <FileText />,       iconBg: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400'  },
      ]
    : [];

  const funnelMax   = Math.max(...funnelStages.map((s) => s.value), 1);
  const convRates   = hasFunnel
    ? [
        pct(funnel!.visits,       funnel!.leads),
        pct(funnel!.reservations, funnel!.visits),
        pct(funnel!.contracts,    funnel!.reservations),
      ]
    : [];

  return (
    <Card className="p-0 overflow-hidden">
      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-hairline bg-slate-50/60">
        <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <LayoutDashboard className="h-3.5 w-3.5 text-brand-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">ملخص المنصة</h2>
      </div>

      {/* ── Zone A: Business metrics strip ────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-px bg-hairline border-b border-hairline">
        {[
          { label: 'مشاريع',       value: kpis.projects                                                         },
          { label: 'وحدات متاحة',  value: kpis.availableUnits,  sub: `محجوز ${kpis.reservedUnits} · مباع ${kpis.soldUnits}` },
          { label: 'عقود موقعة',   value: kpis.signedContracts                                                  },
          { label: 'العملاء',      value: kpis.totalCustomers                                                   },
          { label: 'الفريق',       value: kpis.totalTeam                                                        },
        ].map((m) => (
          <div key={m.label} className="bg-white px-3 py-3.5 text-center">
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{m.value}</p>
            {'sub' in m && m.sub && (
              <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{m.sub}</p>
            )}
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-1 leading-none truncate">
              {m.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Zone B: Financial snapshot ────────────────────────────────────── */}
      {hasFin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline border-b border-hairline">
          {finItems.map((f) => (
            <div key={f.label} className="bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-md [&_svg]:h-3 [&_svg]:w-3 shrink-0',
                    f.iconCn,
                  )}
                >
                  {f.icon}
                </span>
                <p className="text-[10px] text-slate-500 font-semibold leading-none truncate">{f.label}</p>
              </div>
              <p className={cn('text-sm font-extrabold tabular-nums leading-none', f.valueCn)}>
                {f.value}
              </p>
              {f.sub && (
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{f.sub}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Zone C: Conversion pipeline ──────────────────────────────────── */}
      {hasFunnel && (
        <div className="flex items-center px-5 py-4">
          {funnelStages.map((stage, i) => (
            <Fragment key={stage.key}>
              {/* Stage */}
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
                <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-none">{stage.label}</p>
                {/* Proportional mini bar */}
                <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', stage.bar)}
                    style={{ width: `${Math.round((stage.value / funnelMax) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Connector between stages */}
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
