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
  label:       string;
  value:       string;
  sub?:        string;
  icon:        React.ReactNode;
  iconBg:      string;
  valueCn:     string;
}

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
      iconBg:  'bg-brand-50 text-brand-600',
      valueCn: 'text-slate-900',
    },
    {
      label:   'إجمالي المحصّل المؤكد',
      value:   formatCurrency(totalCollectedVerified),
      sub:     collectionRate !== null ? `معدل التحصيل ${collectionRate}%` : 'مدفوعات محققة',
      icon:    <BadgeCheck />,
      iconBg:  'bg-success-50 text-success-600',
      valueCn: 'text-success-700',
    },
    {
      label:   'مبالغ متأخرة',
      value:   formatCurrency(overdueTotal),
      sub:     overdueTotal > 0 ? 'أقساط تجاوزت تاريخ الاستحقاق' : 'لا مبالغ متأخرة',
      icon:    <AlertTriangle />,
      iconBg:  overdueTotal > 0 ? 'bg-danger-50 text-danger-600'  : 'bg-slate-50 text-slate-400',
      valueCn: overdueTotal > 0 ? 'text-danger-700' : 'text-slate-500',
    },
    {
      label:   'التزامات معلقة',
      value:   formatCurrency(pendingLiabilities),
      sub:     'عمولات وسطاء + مكافآت فريق',
      icon:    <Coins />,
      iconBg:  pendingLiabilities > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400',
      valueCn: pendingLiabilities > 0 ? 'text-amber-700' : 'text-slate-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col rounded-2xl border border-hairline bg-white px-4 pt-3.5 pb-3 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-snug">
              {card.label}
            </span>
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0',
                card.iconBg,
              )}
            >
              {card.icon}
            </span>
          </div>
          <span className={cn('text-lg font-bold tabular-nums leading-none', card.valueCn)}>
            {card.value}
          </span>
          {card.sub && (
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
