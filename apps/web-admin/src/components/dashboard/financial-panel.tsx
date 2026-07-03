import { TrendingUp, BadgeCheck, AlertTriangle, Coins } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';
import { Card } from '@/components/ui/card';

interface Props {
  financial: {
    totalContractValue:     number;
    totalCollectedVerified: number;
    overdueTotal:           number;
    pendingBonus:           number;
    pendingBrokerPayouts:   number;
  };
  className?:      string;
  currencySymbol?: string;
}

export function FinancialPanel({ financial, className, currencySymbol = 'ر.س' }: Props) {
  const { totalContractValue, totalCollectedVerified, overdueTotal, pendingBonus, pendingBrokerPayouts } = financial;

  const collectionRate = totalContractValue > 0
    ? Math.round((totalCollectedVerified / totalContractValue) * 100)
    : null;

  const pendingLiabilities = pendingBonus + pendingBrokerPayouts;

  const rows = [
    {
      label:   'إجمالي قيمة العقود',
      value:   formatCompact(totalContractValue, currencySymbol),
      sub:     'قيمة العقود المُبرمة',
      icon:    <TrendingUp />,
      iconBg:  'bg-brand-50 text-brand-600',
      valueCn: 'text-slate-900',
    },
    {
      label:   'إجمالي المحصّل المؤكد',
      value:   formatCompact(totalCollectedVerified, currencySymbol),
      sub:     collectionRate !== null ? `${collectionRate}% معدل التحصيل` : 'مدفوعات محققة',
      icon:    <BadgeCheck />,
      iconBg:  'bg-success-50 text-success-600',
      valueCn: 'text-success-700',
    },
    {
      label:   'مبالغ متأخرة',
      value:   formatCompact(overdueTotal, currencySymbol),
      sub:     overdueTotal > 0 ? 'تجاوزت تاريخ الاستحقاق' : 'لا مبالغ متأخرة',
      icon:    <AlertTriangle />,
      iconBg:  overdueTotal > 0 ? 'bg-danger-50 text-danger-600'  : 'bg-slate-50 text-slate-400',
      valueCn: overdueTotal > 0 ? 'text-danger-700' : 'text-slate-400',
    },
    {
      label:   'التزامات معلقة',
      value:   formatCompact(pendingLiabilities, currencySymbol),
      sub:     'عمولات وسطاء + مكافآت',
      icon:    <Coins />,
      iconBg:  pendingLiabilities > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400',
      valueCn: pendingLiabilities > 0 ? 'text-amber-700' : 'text-slate-400',
    },
  ] as const;

  return (
    <Card className={cn('p-0 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
        <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">اللقطة المالية</h2>
      </div>

      {/* Financial rows */}
      <div className="divide-y divide-hairline">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-5 py-3.5">
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0',
                row.iconBg,
              )}
            >
              {row.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 font-semibold leading-none truncate">{row.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{row.sub}</p>
            </div>
            <span className={cn('text-sm font-extrabold tabular-nums leading-none shrink-0', row.valueCn)}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
