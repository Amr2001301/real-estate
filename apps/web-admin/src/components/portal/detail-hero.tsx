import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

export type DetailHeroStatus = 'success' | 'warning' | 'danger' | 'neutral';

const TOP_BAR: Record<DetailHeroStatus, string> = {
  success: 'from-emerald-300 via-emerald-500 to-emerald-300',
  warning: 'from-amber-300 via-amber-500 to-amber-300',
  danger:  'from-red-300 via-red-500 to-red-300',
  neutral: 'from-slate-200 via-slate-300 to-slate-200',
};

export function DetailHero({
  status = 'neutral',
  children,
}: {
  status?: DetailHeroStatus;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className={cn('h-[3px] bg-gradient-to-l', TOP_BAR[status])} />
      <div className="grid grid-cols-1 lg:grid-cols-3">{children}</div>
    </Card>
  );
}

export function DetailHeroCol({
  position = 'first',
  highlight,
  className,
  children,
}: {
  position?: 'first' | 'middle' | 'last';
  highlight?: DetailHeroStatus;
  className?: string;
  children: ReactNode;
}) {
  const tint =
    highlight === 'success' ? 'bg-emerald-50/40' :
    highlight === 'warning' ? 'bg-amber-50/30'   :
    highlight === 'danger'  ? 'bg-red-50/20'     : '';

  return (
    <div
      className={cn(
        'p-6',
        position === 'middle' && 'border-y lg:border-y-0 lg:border-x border-hairline',
        tint,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HeroColLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </p>
  );
}

export function HeroDateRow({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className={cn(
          'text-xs shrink-0',
          tone === 'success' ? 'text-emerald-700' :
          tone === 'warning' ? 'text-amber-700'   : 'text-slate-500',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-xs text-end tabular-nums',
          tone === 'success' ? 'text-emerald-700 font-semibold' :
          tone === 'warning' ? 'text-amber-700 font-semibold'   :
          'text-slate-800 font-medium',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function StatusDot({ status }: { status: DetailHeroStatus }) {
  const color = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-400',
    danger:  'bg-red-400',
    neutral: 'bg-slate-300',
  }[status];

  return <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', color)} />;
}

const AVATAR_PALETTE = [
  'bg-slate-100 text-slate-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

export function avatarColor(name: string): string {
  if (!name) return AVATAR_PALETTE[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]!;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
