import Link from 'next/link';
import {
  Wrench,
  CalendarCheck2,
  MessageSquare,
  FileText,
  Banknote,
  Clock,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'danger' | 'warning' | 'info' | 'neutral';

const TONE: Record<Tone, { icon: string; badge: string; chevron: string }> = {
  danger:  { icon: 'bg-danger-50 text-danger-600',   badge: 'bg-danger-100 text-danger-700',   chevron: 'text-danger-400' },
  warning: { icon: 'bg-warning-50 text-warning-600', badge: 'bg-warning-100 text-warning-700', chevron: 'text-warning-400' },
  info:    { icon: 'bg-info-50 text-info-600',        badge: 'bg-info-100 text-info-700',       chevron: 'text-info-400' },
  neutral: { icon: 'bg-slate-100 text-slate-400',    badge: 'bg-slate-100 text-slate-400',     chevron: 'text-slate-300' },
};

interface Metric {
  key: string;
  label: string;
  value: number;
  href: string;
  tone: Tone;
  icon: React.ReactNode;
}

interface AlertData {
  contractsAwaitingSignature: number;
  depositsPendingReview: number;
  openMaintenance: number;
  reservationsExpiringSoon: number;
  visitsAwaitingConfirmation: number;
  infoRequestsOpen: number;
}

interface Props {
  alerts: AlertData | null | undefined;
  className?: string;
}

export function OperationalPanel({ alerts, className }: Props) {
  const a = alerts;

  const allMetrics: Metric[] = [
    {
      key: 'maintenance',
      label: 'طلبات صيانة مفتوحة',
      value: a?.openMaintenance ?? 0,
      href: '/dashboard/maintenance',
      tone: 'warning',
      icon: <Wrench />,
    },
    {
      key: 'visits',
      label: 'زيارات بانتظار التأكيد',
      value: a?.visitsAwaitingConfirmation ?? 0,
      href: '/dashboard/visits',
      tone: 'info',
      icon: <CalendarCheck2 />,
    },
    {
      key: 'info',
      label: 'استفسارات مفتوحة',
      value: a?.infoRequestsOpen ?? 0,
      href: '/dashboard/requests',
      tone: 'info',
      icon: <MessageSquare />,
    },
    {
      key: 'deposits',
      label: 'ودائع قيد المراجعة',
      value: a?.depositsPendingReview ?? 0,
      href: '/dashboard/deposits',
      tone: 'warning',
      icon: <Banknote />,
    },
    {
      key: 'contracts',
      label: 'عقود بانتظار التوقيع',
      value: a?.contractsAwaitingSignature ?? 0,
      href: '/dashboard/contracts',
      tone: 'danger',
      icon: <FileText />,
    },
    {
      key: 'expiring',
      label: 'حجوزات تنتهي قريباً',
      value: a?.reservationsExpiringSoon ?? 0,
      href: '/dashboard/reservations',
      tone: 'danger',
      icon: <Clock />,
    },
  ];

  // Show only actionable (non-zero) items
  const activeMetrics = allMetrics.filter(m => m.value > 0);
  const totalActions = activeMetrics.reduce((s, m) => s + m.value, 0);
  const hasActions = activeMetrics.length > 0;

  return (
    <div className={cn(
      'rounded-2xl border border-hairline bg-surface shadow-soft overflow-hidden flex flex-col',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline bg-surface-muted/25 shrink-0">
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            hasActions
              ? 'bg-warning-500 ring-4 ring-warning-500/20'
              : 'bg-success-500 ring-4 ring-success-500/20',
          )}
        />
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex-1 truncate">
          مركز المتابعة التشغيلية
        </h3>
        {hasActions && (
          <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-warning-100 text-warning-700 text-2xs font-bold shrink-0">
            {totalActions}
          </span>
        )}
      </div>

      {/* Action list — active items only, card-like rows */}
      <div className="flex-1 overflow-auto p-3">
        {hasActions ? (
          <div className="flex flex-col gap-2">
            {activeMetrics.map((m) => {
              const t = TONE[m.tone];
              return (
                <Link
                  key={m.key}
                  href={m.href as never}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5',
                    'overflow-hidden transition-colors duration-150',
                    'hover:bg-brand-50/40 hover:border-brand-200',
                  )}
                >
                  {/* Gold start-side accent on hover, clipped by overflow-hidden */}
                  <span className="absolute start-0 inset-y-0 w-[3px] bg-brand-400/0 group-hover:bg-brand-400/40 transition-colors duration-150 pointer-events-none" />
                  <span className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px] shrink-0',
                    t.icon,
                  )}>
                    {m.icon}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-slate-700 leading-snug truncate">
                    {m.label}
                  </span>
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full text-xs font-bold tabular-nums shrink-0',
                    t.badge,
                  )}>
                    {m.value}
                  </span>
                  <ChevronLeft className={cn('h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', t.chevron)} aria-hidden />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-success-400" aria-hidden />
            <p className="text-sm font-medium text-slate-600">كل الأمور سليمة</p>
            <p className="text-xs text-slate-400">لا إجراءات معلقة حالياً</p>
          </div>
        )}
      </div>

      {/* Footer — outline pill CTA */}
      <div className="border-t border-hairline px-4 py-3 shrink-0">
        <Link
          href={'/dashboard/operations' as never}
          className="flex w-full items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-700 border border-brand-200/70 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-800 transition-colors"
        >
          عرض كل الإجراءات
        </Link>
      </div>
    </div>
  );
}
