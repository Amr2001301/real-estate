import Link from 'next/link';
import {
  FileText,
  Wrench,
  CalendarCheck2,
  MessageSquare,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AlertData {
  contractsAwaitingSignature: number;
  depositsPendingReview: number;
  openMaintenance: number;
  reservationsExpiringSoon: number;
  visitsAwaitingConfirmation: number;
  infoRequestsOpen: number;
}

type Tone = 'danger' | 'warning' | 'info';

const TONE: Record<Tone, {
  iconActive:   string;
  iconInactive: string;
  count:        string;
  bar:          string;
  hover:        string;
}> = {
  danger: {
    iconActive:   'bg-danger-50 text-danger-600 ring-danger-100',
    iconInactive: 'bg-slate-50 text-slate-300 ring-slate-100',
    count:        'text-danger-700',
    bar:          'bg-danger-400',
    hover:        'group-hover:border-danger-200 group-hover:shadow-card',
  },
  warning: {
    iconActive:   'bg-amber-50 text-amber-600 ring-amber-100',
    iconInactive: 'bg-slate-50 text-slate-300 ring-slate-100',
    count:        'text-amber-700',
    bar:          'bg-amber-400',
    hover:        'group-hover:border-amber-200 group-hover:shadow-card',
  },
  info: {
    iconActive:   'bg-info-50 text-info-600 ring-info-100',
    iconInactive: 'bg-slate-50 text-slate-300 ring-slate-100',
    count:        'text-info-700',
    bar:          'bg-info-400',
    hover:        'group-hover:border-info-200 group-hover:shadow-card',
  },
};

interface ActionItem {
  key:         string;
  label:       string;
  description: string;
  value:       number;
  href:        string;
  tone:        Tone;
  icon:        ReactNode;
}

function buildItems(a: AlertData | null | undefined): ActionItem[] {
  return [
    {
      key:         'contracts',
      label:       'عقود بانتظار التوقيع',
      description: 'معلقة توقيع العميل',
      value:       a?.contractsAwaitingSignature ?? 0,
      href:        '/dashboard/contracts',
      tone:        'danger',
      icon:        <FileText />,
    },
    {
      key:         'maintenance',
      label:       'طلبات صيانة مفتوحة',
      description: 'لم تُعالج بعد',
      value:       a?.openMaintenance ?? 0,
      href:        '/dashboard/maintenance',
      tone:        'warning',
      icon:        <Wrench />,
    },
    {
      key:         'visits',
      label:       'زيارات بانتظار التأكيد',
      description: 'تحتاج جدولة موعد',
      value:       a?.visitsAwaitingConfirmation ?? 0,
      href:        '/dashboard/visits',
      tone:        'info',
      icon:        <CalendarCheck2 />,
    },
    {
      key:         'requests',
      label:       'استفسارات مفتوحة',
      description: 'بانتظار رد الفريق',
      value:       a?.infoRequestsOpen ?? 0,
      href:        '/dashboard/requests',
      tone:        'info',
      icon:        <MessageSquare />,
    },
  ];
}

export function ActionQueue({ alerts }: { alerts: AlertData | null | undefined }) {
  const items = buildItems(alerts);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => {
        const t       = TONE[item.tone];
        const active  = item.value > 0;
        return (
          <Link key={item.key} href={item.href as never} className="block group">
            <div
              className={cn(
                'h-full rounded-2xl bg-white border border-hairline shadow-xs p-4 transition-all duration-150',
                t.hover,
              )}
            >
              {/* Icon */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center ring-1 shrink-0 [&_svg]:h-4 [&_svg]:w-4',
                    active ? t.iconActive : t.iconInactive,
                  )}
                >
                  {item.icon}
                </div>
              </div>

              {/* Count */}
              <p
                className={cn(
                  'text-3xl font-extrabold tabular-nums leading-none',
                  active ? t.count : 'text-slate-300',
                )}
              >
                {item.value.toLocaleString('ar-SA')}
              </p>

              {/* Label */}
              <p className="text-xs font-semibold text-slate-600 mt-1.5 leading-tight">
                {item.label}
              </p>

              {/* Description */}
              <p className="text-2xs text-slate-400 mt-1 leading-tight">
                {item.description}
              </p>

              {/* Bottom bar */}
              <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    active ? t.bar : 'bg-transparent',
                  )}
                  style={{ width: active ? '100%' : '0%' }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
