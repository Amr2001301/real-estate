import { TrendingUp, BadgeCheck, AlertTriangle, Coins } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  totalContractValue:     number;
  totalCollectedVerified: number;
  overdueTotal:           number;
  pendingBonus:           number;
  pendingBrokerPayouts:   number;
}

interface FinKpiCard {
  label:   string;
  value:   string;
  sub?:    string;
  icon:    React.ReactNode;
  valueCn: string;
}

const GOLD_BAR = { background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' } as const;

export function FinancialStrip({
  totalContractValue,
  totalCollectedVerified,
  overdueTotal,
  pendingBonus,
  pendingBrokerPayouts,
}: Props) {
  const collectionRate =
    totalContractValue > 0
      ? Math.round((totalCollectedVerified / totalContractValue) * 100)
      : null;

  const pendingLiabilities = pendingBonus + pendingBrokerPayouts;

  const cards: FinKpiCard[] = [
    {
      label:   'إجمالي قيمة العقود',
      value:   formatCurrency(totalContractValue),
      sub:     'قيمة جميع العقود المُبرمة',
      icon:    <TrendingUp />,
      valueCn: 'text-slate-900',
    },
    {
      label:   'إجمالي المحصّل المؤكد',
      value:   formatCurrency(totalCollectedVerified),
      sub:     collectionRate !== null ? `معدل التحصيل ${collectionRate}%` : 'مدفوعات محققة',
      icon:    <BadgeCheck />,
      valueCn: 'text-success-700',
    },
    {
      label:   'مبالغ متأخرة',
      value:   formatCurrency(overdueTotal),
      sub:     overdueTotal > 0 ? 'أقساط تجاوزت تاريخ الاستحقاق' : 'لا مبالغ متأخرة',
      icon:    <AlertTriangle />,
      valueCn: overdueTotal > 0 ? 'text-danger-700' : 'text-slate-400',
    },
    {
      label:   'التزامات معلقة',
      value:   formatCurrency(pendingLiabilities),
      sub:     'عمولات وسطاء + مكافآت فريق',
      icon:    <Coins />,
      valueCn: pendingLiabilities > 0 ? 'text-amber-700' : 'text-slate-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
          <div className="h-[3px] w-full shrink-0" style={GOLD_BAR} />
          <div className="px-4 py-4 pt-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {card.icon}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide leading-snug text-slate-400">
                {card.label}
              </span>
            </div>
            <span className={cn('text-lg font-bold tabular-nums leading-none', card.valueCn)}>
              {card.value}
            </span>
            {card.sub && (
              <p className="mt-1 text-[10px] leading-snug text-slate-400">{card.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
