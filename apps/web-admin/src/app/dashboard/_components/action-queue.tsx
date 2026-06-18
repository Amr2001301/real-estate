import Link from 'next/link';
import {
  FileText,
  Wrench,
  CalendarCheck2,
  MessageSquare,
  Banknote,
  Clock,
  Bell,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AlertData {
  contractsAwaitingSignature:  number;
  depositsPendingReview:       number;
  openMaintenance:             number;
  reservationsExpiringSoon:    number;
  visitsAwaitingConfirmation:  number;
  infoRequestsOpen:            number;
}

type Tone = 'danger' | 'warning' | 'info';

const TONE: Record<Tone, { icon: string; count: string; dot: string; cta: string }> = {
  danger:  { icon: 'bg-danger-50 text-danger-600',  count: 'text-danger-700',  dot: 'bg-danger-500',  cta: 'text-danger-600 group-hover:text-danger-700'  },
  warning: { icon: 'bg-amber-50 text-amber-600',    count: 'text-amber-700',   dot: 'bg-amber-500',   cta: 'text-amber-600 group-hover:text-amber-700'    },
  info:    { icon: 'bg-info-50 text-info-600',      count: 'text-info-700',    dot: 'bg-info-500',    cta: 'text-info-600 group-hover:text-info-700'      },
};

interface ActionItem {
  key:         string;
  label:       string;
  description: string;
  value:       number;
  href:        string;
  tone:        Tone;
  priority:    number;
  icon:        ReactNode;
}

function buildItems(a: AlertData | null | undefined): ActionItem[] {
  const list: ActionItem[] = [
    {
      key: 'contracts', label: 'عقود بانتظار التوقيع', description: 'معلقة توقيع العميل',
      value: a?.contractsAwaitingSignature ?? 0, href: '/dashboard/contracts',
      tone: 'danger', priority: 1, icon: <FileText />,
    },
    {
      key: 'deposits', label: 'دفعات بانتظار المراجعة', description: 'تحتاج موافقة المشرف',
      value: a?.depositsPendingReview ?? 0, href: '/dashboard/deposits',
      tone: 'danger', priority: 2, icon: <Banknote />,
    },
    {
      key: 'maintenance', label: 'طلبات صيانة مفتوحة', description: 'لم تُعالج بعد',
      value: a?.openMaintenance ?? 0, href: '/dashboard/maintenance',
      tone: 'warning', priority: 3, icon: <Wrench />,
    },
    {
      key: 'reservations', label: 'حجوزات تنتهي قريبًا', description: 'تحتاج تحويل أو تجديد',
      value: a?.reservationsExpiringSoon ?? 0, href: '/dashboard/reservations',
      tone: 'warning', priority: 4, icon: <Clock />,
    },
    {
      key: 'visits', label: 'زيارات بانتظار التأكيد', description: 'تحتاج جدولة موعد',
      value: a?.visitsAwaitingConfirmation ?? 0, href: '/dashboard/visits',
      tone: 'info', priority: 5, icon: <CalendarCheck2 />,
    },
    {
      key: 'requests', label: 'استفسارات مفتوحة', description: 'بانتظار رد الفريق',
      value: a?.infoRequestsOpen ?? 0, href: '/dashboard/requests',
      tone: 'info', priority: 6, icon: <MessageSquare />,
    },
  ];

  // Active items first, then by severity priority
  return list.sort((a, b) => {
    if (a.value > 0 && b.value === 0) return -1;
    if (a.value === 0 && b.value > 0) return 1;
    return a.priority - b.priority;
  });
}

export function ActionQueue({ alerts }: { alerts: AlertData | null | undefined }) {
  const items = buildItems(alerts);
  const total = items.reduce((s, i) => s + i.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center gap-3 bg-success-50 border border-success-100 rounded-2xl px-5 py-4">
        <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-success-800">لا توجد إجراءات معلقة</p>
          <p className="text-xs text-success-600 mt-0.5">كل العمليات تسير بشكل طبيعي</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline bg-canvas/50">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Bell className="h-4 w-4 text-slate-600" />
            <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
          </div>
          <p className="text-[13px] font-bold text-slate-800">يتطلب اتخاذ إجراء</p>
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-danger-50 border border-danger-100 text-danger-700 text-[10px] font-bold">
            {total} معلق
          </span>
        </div>
        <p className="text-[11px] text-slate-400 hidden sm:block">انقر على أي بند للانتقال مباشرةً</p>
      </div>

      {/* 6-slot grid — gap-px creates hairline dividers between cells */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-hairline">
        {items.map((item) => {
          const t      = TONE[item.tone];
          const active = item.value > 0;

          return (
            <Link
              key={item.key}
              href={item.href as never}
              className={cn('group block', !active && 'pointer-events-none')}
            >
              <div className={cn(
                'bg-surface h-full px-4 py-4 flex flex-col gap-2.5 transition-colors duration-150',
                active && 'hover:bg-slate-50/80',
              )}>

                {/* Icon + live dot */}
                <div className="flex items-start justify-between">
                  <div className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0',
                    active ? t.icon : 'bg-slate-50 text-slate-300',
                  )}>
                    {item.icon}
                  </div>
                  {active && (
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0 mt-1', t.dot)} />
                  )}
                </div>

                {/* Count */}
                <p className={cn(
                  'text-[28px] font-black tabular-nums leading-none tracking-tight',
                  active ? t.count : 'text-slate-200',
                )}>
                  {item.value}
                </p>

                {/* Label + description */}
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-slate-700 leading-snug">{item.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.description}</p>
                </div>

                {/* CTA */}
                {active && (
                  <div className={cn(
                    'flex items-center gap-1 text-[10px] font-bold transition-colors',
                    t.cta,
                  )}>
                    مراجعة
                    <ArrowLeft className="h-3 w-3" />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
