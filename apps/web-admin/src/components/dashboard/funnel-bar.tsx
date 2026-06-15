import { Users, CalendarCheck2, BookmarkCheck, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FunnelStage {
  key:    string;
  label:  string;
  sub:    string;
  value:  number;
  icon:   React.ReactNode;
  iconBg: string;
  bar:    string;
}

interface Props {
  leads:        number;
  visits:       number;
  reservations: number;
  contracts:    number;
}

function convRate(from: number, to: number): string | null {
  if (from === 0) return null;
  return `${Math.round((to / from) * 100)}%`;
}

export function FunnelBar({ leads, visits, reservations, contracts }: Props) {
  const stages: FunnelStage[] = [
    {
      key:    'leads',
      label:  'فرص المبيعات',
      sub:    'إجمالي الفرص',
      value:  leads,
      icon:   <Users />,
      iconBg: 'bg-purple-50 text-purple-600',
      bar:    'bg-purple-300',
    },
    {
      key:    'visits',
      label:  'الزيارات',
      sub:    'طلبات الزيارة',
      value:  visits,
      icon:   <CalendarCheck2 />,
      iconBg: 'bg-info-50 text-info-600',
      bar:    'bg-info-300',
    },
    {
      key:    'reservations',
      label:  'الحجوزات',
      sub:    'حجوزات مؤكدة',
      value:  reservations,
      icon:   <BookmarkCheck />,
      iconBg: 'bg-brand-50 text-brand-600',
      bar:    'bg-brand-300',
    },
    {
      key:    'contracts',
      label:  'العقود الموقعة',
      sub:    'عقد رسمي موقع',
      value:  contracts,
      icon:   <FileText />,
      iconBg: 'bg-success-50 text-success-600',
      bar:    'bg-success-400',
    },
  ];

  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const rates = [
    convRate(leads, visits),
    convRate(visits, reservations),
    convRate(reservations, contracts),
  ];

  return (
    <div className="flex items-stretch gap-0 rounded-2xl border border-hairline bg-white shadow-xs overflow-hidden">
      {stages.map((stage, i) => {
        const barPct   = Math.round((stage.value / maxValue) * 100);
        const rate     = i < rates.length ? rates[i] : null;
        const isLast   = i === stages.length - 1;

        return (
          <div
            key={stage.key}
            className={cn(
              'flex-1 flex flex-col px-3.5 pt-3.5 pb-0 relative',
              !isLast && 'border-e border-hairline',
            )}
          >
            {/* Icon */}
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5 mb-2',
                stage.iconBg,
              )}
            >
              {stage.icon}
            </span>

            {/* Count */}
            <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
              {stage.value.toLocaleString('ar-SA')}
            </span>

            {/* Label */}
            <p className="text-xs font-semibold text-slate-700 mt-1 leading-tight">
              {stage.label}
            </p>

            {/* Sub-label */}
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug mb-3">
              {stage.sub}
            </p>

            {/* Conversion rate badge (shows rate from THIS stage to next) */}
            {!isLast && rate !== null && (
              <div className="absolute bottom-3 end-0 translate-x-1/2 rtl:-translate-x-1/2 z-10">
                <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold tabular-nums border border-hairline shadow-xs">
                  {rate}
                </span>
              </div>
            )}

            {/* Bottom bar — proportional height fills */}
            <div className="h-1.5 w-full overflow-hidden mt-auto">
              <div
                className={cn('h-full rounded-full transition-all duration-500', stage.bar)}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
