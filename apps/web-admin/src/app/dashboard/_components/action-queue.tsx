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

const TONE: Record<Tone, { icon: string; count: string; dot: string }> = {
  danger:  { icon: 'bg-danger-50 text-danger-600',  count: 'text-danger-700',  dot: 'bg-danger-500'  },
  warning: { icon: 'bg-amber-50 text-amber-600',    count: 'text-amber-700',   dot: 'bg-amber-500'   },
  info:    { icon: 'bg-info-50 text-info-600',      count: 'text-info-700',    dot: 'bg-info-500'    },
};

// Maps active-item count → Tailwind grid-cols class so all cards sit in one row on lg
const COL_CLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-3 lg:grid-cols-6',
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

  return list.sort((a, b) => {
    if (a.value > 0 && b.value === 0) return -1;
    if (a.value === 0 && b.value > 0) return 1;
    return a.priority - b.priority;
  });
}

export function ActionQueue({ alerts }: { alerts: AlertData | null | undefined }) {
  const items       = buildItems(alerts);
  const total       = items.reduce((s, i) => s + i.value, 0);
  const activeItems = items.filter((i) => i.value > 0);
  const clearedItems = items.filter((i) => i.value === 0);

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

  const colCls = COL_CLS[activeItems.length] ?? 'grid-cols-3 lg:grid-cols-6';

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 rounded-xl bg-danger-50 ring-1 ring-danger-100 flex items-center justify-center shrink-0">
            <Bell className="h-[15px] w-[15px] text-danger-600" />
            <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-navy leading-none">يتطلب اتخاذ إجراء</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{total} بند يحتاج متابعة</p>
          </div>
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-danger-50 border border-danger-100 text-danger-700 text-[10px] font-bold ms-1">
            {total} معلق
          </span>
        </div>
        <p className="text-[11px] text-slate-400 hidden sm:block">انقر على أي بند للانتقال مباشرةً</p>
      </div>

      {/* Active items — one row of equal cards */}
      <div className={cn('grid gap-px bg-hairline', colCls)}>
        {activeItems.map((item) => {
          const t = TONE[item.tone];
          return (
            <Link key={item.key} href={item.href as never} className="group block">
              <div className="bg-surface h-full px-5 py-5 flex flex-col gap-2.5 hover:bg-canvas/60 transition-colors duration-150">

                {/* Icon + pulsing dot */}
                <div className="flex items-start justify-between gap-2">
                  <div className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center [&_svg]:h-4 [&_svg]:w-4 shrink-0',
                    t.icon,
                  )}>
                    {item.icon}
                  </div>
                  <span className={cn('h-2 w-2 rounded-full animate-pulse mt-1.5 shrink-0', t.dot)} />
                </div>

                {/* Count */}
                <p className={cn('text-[30px] font-black tabular-nums leading-none mt-0.5', t.count)}>
                  {item.value}
                </p>

                {/* Label */}
                <p className="text-[12.5px] font-bold text-slate-800 leading-snug">
                  {item.label}
                </p>

                {/* Description */}
                <p className="text-[11px] text-slate-400 leading-none mt-auto">
                  {item.description}
                </p>

              </div>
            </Link>
          );
        })}
      </div>

      {/* Cleared items — compact footer */}
      {clearedItems.length > 0 && (
        <div className="px-6 py-2.5 border-t border-hairline bg-canvas/40 flex items-center gap-x-4 gap-y-1 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">مكتمل:</span>
          {clearedItems.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="h-3 w-3 text-success-500 shrink-0" />
              {item.label}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
