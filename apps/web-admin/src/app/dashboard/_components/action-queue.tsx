import Link from 'next/link';
import {
  FileText,
  Wrench,
  CalendarCheck2,
  MessageSquare,
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

interface ActionItem {
  key:         string;
  label:       string;
  description: string;
  value:       number;
  href:        string;
  tone:        Tone;
  icon:        ReactNode;
}

// Fixed 4 items in RTL priority order (right → left: contracts, maintenance, visits, requests)
function buildItems(a: AlertData | null | undefined): ActionItem[] {
  return [
    {
      key: 'contracts', label: 'عقود بانتظار التوقيع', description: 'معلقة توقيع العميل',
      value: a?.contractsAwaitingSignature ?? 0, href: '/dashboard/contracts',
      tone: 'danger', icon: <FileText />,
    },
    {
      key: 'maintenance', label: 'طلبات صيانة مفتوحة', description: 'لم تُعالج بعد',
      value: a?.openMaintenance ?? 0, href: '/dashboard/maintenance',
      tone: 'warning', icon: <Wrench />,
    },
    {
      key: 'visits', label: 'زيارات بانتظار التأكيد', description: 'تحتاج جدولة موعد',
      value: a?.visitsAwaitingConfirmation ?? 0, href: '/dashboard/visits',
      tone: 'info', icon: <CalendarCheck2 />,
    },
    {
      key: 'requests', label: 'استفسارات مفتوحة', description: 'بانتظار رد الفريق',
      value: a?.infoRequestsOpen ?? 0, href: '/dashboard/requests',
      tone: 'info', icon: <MessageSquare />,
    },
  ];
}

export function ActionQueue({ alerts }: { alerts: AlertData | null | undefined }) {
  const items = buildItems(alerts);
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <div className={cn(
            'relative h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
            total > 0
              ? 'bg-danger-50 ring-1 ring-danger-100'
              : 'bg-success-50 ring-1 ring-success-100',
          )}>
            {total > 0 ? (
              <>
                <Bell className="h-[15px] w-[15px] text-danger-600" />
                <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
              </>
            ) : (
              <CheckCircle2 className="h-[15px] w-[15px] text-success-600" />
            )}
          </div>
          <div>
            <p className={cn(
              'text-[14px] font-bold leading-none',
              total > 0 ? 'text-navy' : 'text-success-800',
            )}>
              يتطلب اتخاذ إجراء
            </p>
            <p className={cn('text-[11px] mt-0.5', total > 0 ? 'text-slate-400' : 'text-success-600')}>
              {total > 0 ? `${total} بند يحتاج متابعة` : 'كل العمليات تسير بشكل طبيعي'}
            </p>
          </div>
          {total > 0 && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-danger-50 border border-danger-100 text-danger-700 text-[10px] font-bold ms-1">
              {total} معلق
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 hidden sm:block">
          {total > 0 ? 'انقر على أي بند للانتقال مباشرةً' : 'لا إجراءات معلقة'}
        </p>
      </div>

      {/* 4-card grid — always fully rendered */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline">
        {items.map((item) => {
          const isActive = item.value > 0;
          const t        = TONE[item.tone];
          return (
            <Link key={item.key} href={item.href as never} className="group block">
              <div className={cn(
                'bg-surface h-full px-5 py-5 flex flex-col gap-3 hover:bg-canvas/60 transition-colors duration-150',
                !isActive && 'opacity-70',
              )}>

                {/* Label + icon row */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium text-slate-400 leading-snug">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive && (
                      <span className={cn('h-2 w-2 rounded-full animate-pulse shrink-0', t.dot)} />
                    )}
                    <div className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center [&_svg]:h-4 [&_svg]:w-4 shrink-0',
                      isActive ? t.icon : 'bg-success-50 text-success-600',
                    )}>
                      {isActive ? item.icon : <CheckCircle2 />}
                    </div>
                  </div>
                </div>

                {/* Count */}
                <p className={cn(
                  'text-[30px] font-black tabular-nums leading-none',
                  isActive ? t.count : 'text-success-600',
                )}>
                  {item.value}
                </p>

                {/* Description */}
                <p className="text-[11px] text-slate-400 leading-snug mt-auto">
                  {isActive ? item.description : 'لا إجراءات معلقة'}
                </p>

              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
