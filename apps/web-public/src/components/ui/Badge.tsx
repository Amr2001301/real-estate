import { cn } from '@/lib/cn';

type Tone = 'gold' | 'navy' | 'neutral' | 'success' | 'warning';

const TONES: Record<Tone, string> = {
  gold: 'bg-gold-100 text-gold-600',
  navy: 'bg-navy text-white',
  neutral: 'bg-surface-soft text-ink-muted',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-tight',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
