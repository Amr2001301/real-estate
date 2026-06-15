import Link from 'next/link';
import {
  Banknote,
  FileText,
  Clock,
  Wrench,
  CalendarCheck2,
  MessageSquare,
  CheckCircle2,
  Bell,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

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
  iconBg: string;
  count:  string;
  bar:    string;
  hover:  string;
  border: string;
}> = {
  danger: {
    iconBg: 'bg-danger-50 text-danger-600 ring-danger-100',
    count:  'text-danger-700',
    bar:    'bg-danger-400',
    hover:  'hover:border-danger-200 hover:shadow-card',
    border: 'border-hairline',
  },
  warning: {
    iconBg: 'bg-amber-50 text-amber-600 ring-amber-100',
    count:  'text-amber-700',
    bar:    'bg-amber-400',
    hover:  'hover:border-amber-200 hover:shadow-card',
    border: 'border-hairline',
  },
  info: {
    iconBg: 'bg-info-50 text-info-600 ring-info-100',
    count:  'text-info-700',
    bar:    'bg-info-400',
    hover:  'hover:border-info-200 hover:shadow-card',
    border: 'border-hairline',
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
      key:         'deposits',
      label:       'ودائع قيد المراجعة',
      description: 'تحتاج تحققاً وقبولاً',
      value:       a?.depositsPendingReview ?? 0,
      href:        '/dashboard/deposits',
      tone:        'warning',
      icon:        <Banknote />,
    },
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
      key:         'expiring',
      label:       'حجوزات تنتهي قريباً',
      description: 'خلال الأيام السبعة القادمة',
      value:       a?.reservationsExpiringSoon ?? 0,
      href:        '/dashboard/reservations',
      tone:        'danger',
      icon:        <Clock />,
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
  const items       = buildItems(alerts);
  const activeItems = items.filter((i) => i.value > 0);
  const totalCount  = activeItems.reduce((s, i) => s + i.value, 0);
  const hasActions  = activeItems.length > 0;

  return (
    <Card className="h-full p-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
        <div className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
          hasActions ? 'bg-amber-50' : 'bg-slate-100',
        )}>
          <Bell className={cn('h-3.5 w-3.5', hasActions ? 'text-amber-500' : 'text-slate-400')} />
        </div>
        <h2 className="text-sm font-bold text-slate-900">يتطلب اتخاذ إجراء</h2>
        {hasActions && (
          <span className="inline-flex items-center h-5 min-w-[22px] px-1.5 rounded-full bg-amber-100 text-amber-700 text-2xs font-bold tabular-nums">
            {totalCount}
          </span>
        )}
        {!hasActions && (
          <span className="text-2xs text-slate-400 ms-auto">لا توجد مهام معلقة</span>
        )}
      </div>

      {/* Content */}
      {hasActions ? (
        <div className="p-4 grid grid-cols-2 gap-3">
          {activeItems.map((item) => {
            const t = TONE[item.tone];
            return (
              <Link
                key={item.key}
                href={item.href as never}
                className={cn(
                  'group block rounded-2xl bg-white border shadow-xs p-4 transition-all duration-150',
                  t.border,
                  t.hover,
                )}
              >
                {/* Icon */}
                <div className="mb-3">
                  <div
                    className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center ring-1 [&_svg]:h-4 [&_svg]:w-4',
                      t.iconBg,
                    )}
                  >
                    {item.icon}
                  </div>
                </div>

                {/* Count */}
                <p className={cn('text-3xl font-extrabold tabular-nums leading-none', t.count)}>
                  {item.value.toLocaleString('ar-SA')}
                </p>

                {/* Label */}
                <p className="text-xs font-semibold text-slate-700 mt-1.5 leading-tight">
                  {item.label}
                </p>

                {/* Description */}
                <p className="text-2xs text-slate-400 mt-0.5 leading-tight">
                  {item.description}
                </p>

                {/* Accent bar */}
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={cn('h-full rounded-full w-full', t.bar)} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3 m-4 rounded-2xl border border-hairline bg-success-50/50 px-4 py-4">
          <CheckCircle2 className="h-5 w-5 text-success-500 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-slate-700">كل الأمور سليمة</p>
            <p className="text-xs text-slate-400 mt-0.5">لا إجراءات معلقة حالياً — المتابعة جارية</p>
          </div>
        </div>
      )}
    </Card>
  );
}
