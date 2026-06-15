import Link from 'next/link';
import {
  Banknote,
  FileText,
  Clock,
  Wrench,
  CalendarCheck2,
  MessageSquare,
  CheckCircle2,
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

const TONE_LABEL: Record<Tone, string> = {
  danger:  'عاجل',
  warning: 'مراجعة',
  info:    'للمتابعة',
};

const TONE: Record<Tone, {
  border:  string;
  iconBg:  string;
  count:   string;
  badge:   string;
  bar:     string;
  hover:   string;
}> = {
  danger: {
    border: 'border-s-danger-400',
    iconBg: 'bg-danger-50 text-danger-600',
    count:  'text-danger-700',
    badge:  'bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100',
    bar:    'bg-danger-300',
    hover:  'hover:border-danger-200 hover:shadow-sm hover:bg-danger-50/20',
  },
  warning: {
    border: 'border-s-amber-400',
    iconBg: 'bg-amber-50 text-amber-600',
    count:  'text-amber-700',
    badge:  'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100',
    bar:    'bg-amber-300',
    hover:  'hover:border-amber-200 hover:shadow-sm hover:bg-amber-50/20',
  },
  info: {
    border: 'border-s-info-400',
    iconBg: 'bg-info-50 text-info-600',
    count:  'text-info-700',
    badge:  'bg-info-50 text-info-600 ring-1 ring-inset ring-info-100',
    bar:    'bg-info-300',
    hover:  'hover:border-info-200 hover:shadow-sm hover:bg-info-50/20',
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
      description: 'دفعات تحتاج تحققاً وقبولاً',
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
      description: 'تنتهي خلال الأيام السبعة القادمة',
      value:       a?.reservationsExpiringSoon ?? 0,
      href:        '/dashboard/reservations',
      tone:        'danger',
      icon:        <Clock />,
    },
    {
      key:         'maintenance',
      label:       'طلبات صيانة مفتوحة',
      description: 'طلبات لم تُعالج بعد',
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
    <section>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            hasActions
              ? 'bg-amber-500 ring-4 ring-amber-500/20'
              : 'bg-success-500 ring-4 ring-success-500/20',
          )}
        />
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
          يتطلب اتخاذ إجراء
        </h2>
        {hasActions && (
          <span className="inline-flex items-center h-5 min-w-[22px] px-1.5 rounded-full bg-amber-100 text-amber-700 text-2xs font-bold tabular-nums">
            {totalCount}
          </span>
        )}
        <div className="flex-1 h-px bg-hairline" />
      </div>

      {hasActions ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activeItems.map((item) => {
            const t = TONE[item.tone];
            return (
              <Link
                key={item.key}
                href={item.href as never}
                className={cn(
                  'group flex flex-col rounded-xl border border-hairline border-s-[3px] bg-white',
                  'overflow-hidden shadow-soft transition-all duration-150',
                  t.border,
                  t.hover,
                )}
              >
                {/* Card body */}
                <div className="flex flex-col flex-1 px-4 pt-4 pb-4">

                  {/* Row 1: icon (start) + tone badge (end) */}
                  <div className="flex items-start justify-between mb-4">
                    <span
                      className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px] shrink-0',
                        t.iconBg,
                      )}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center h-5 px-2 rounded-full text-[9px] font-bold tracking-wide',
                        t.badge,
                      )}
                    >
                      {TONE_LABEL[item.tone]}
                    </span>
                  </div>

                  {/* Count — primary hierarchy */}
                  <span
                    className={cn(
                      'text-3xl font-bold tabular-nums leading-none mb-2',
                      t.count,
                    )}
                  >
                    {item.value}
                  </span>

                  {/* Label */}
                  <p className="text-sm font-semibold text-slate-800 leading-tight">
                    {item.label}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    {item.description}
                  </p>

                </div>

                {/* Accent bar — mirrors broker card bottom treatment */}
                <div className={cn('h-[3px] w-full shrink-0', t.bar)} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-success-50/50 px-4 py-3.5">
          <CheckCircle2 className="h-5 w-5 text-success-500 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-slate-700">كل الأمور سليمة</p>
            <p className="text-xs text-slate-400 mt-0.5">
              لا إجراءات معلقة حالياً — المتابعة جارية
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
