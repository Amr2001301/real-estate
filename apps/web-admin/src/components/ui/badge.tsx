import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'gray'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'purple';

type Size = 'sm' | 'md';
type Variant = 'soft' | 'solid' | 'outline';

const TONE_SOFT: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  accent: 'bg-accent-50 text-accent-700',
  purple: 'bg-purple-50 text-purple-700',
};

const TONE_SOLID: Record<BadgeTone, string> = {
  gray: 'bg-slate-700 text-white',
  brand: 'bg-brand-600 text-white',
  success: 'bg-success-600 text-white',
  warning: 'bg-warning-600 text-white',
  danger: 'bg-danger-600 text-white',
  info: 'bg-info-600 text-white',
  accent: 'bg-accent-600 text-white',
  purple: 'bg-purple-600 text-white',
};

const TONE_OUTLINE: Record<BadgeTone, string> = {
  gray: 'border border-slate-200 text-slate-700 bg-surface',
  brand: 'border border-brand-200 text-brand-700 bg-surface',
  success: 'border border-success-100 text-success-700 bg-surface',
  warning: 'border border-warning-100 text-warning-700 bg-surface',
  danger: 'border border-danger-100 text-danger-700 bg-surface',
  info: 'border border-info-100 text-info-700 bg-surface',
  accent: 'border border-accent-100 text-accent-700 bg-surface',
  purple: 'border border-purple-200 text-purple-700 bg-surface',
};

const SIZE: Record<Size, string> = {
  sm: 'h-5 px-1.5 text-2xs',
  md: 'h-6 px-2 text-xs',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: Variant;
  size?: Size;
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'gray', variant = 'soft', size = 'md', dot, className, children, ...rest },
  ref,
) {
  const toneClasses =
    variant === 'solid'
      ? TONE_SOLID[tone]
      : variant === 'outline'
        ? TONE_OUTLINE[tone]
        : TONE_SOFT[tone];

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        toneClasses,
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor(tone, variant))} />}
      {children}
    </span>
  );
});

function dotColor(tone: BadgeTone, variant: Variant): string {
  if (variant === 'solid') return 'bg-white/80';
  switch (tone) {
    case 'gray':
      return 'bg-slate-500';
    case 'brand':
      return 'bg-brand-600';
    case 'success':
      return 'bg-success-600';
    case 'warning':
      return 'bg-warning-600';
    case 'danger':
      return 'bg-danger-600';
    case 'info':
      return 'bg-info-600';
    case 'accent':
      return 'bg-accent-600';
    case 'purple':
      return 'bg-purple-600';
  }
}
