import { cn } from '@/lib/cn';

type Tone = 'gold' | 'navy' | 'soft';

const TONES: Record<Tone, string> = {
  gold: 'bg-gold-100 text-gold-600',
  navy: 'bg-navy text-white',
  soft: 'bg-surface-soft text-navy',
};

interface IconCircleProps {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}

export function IconCircle({ tone = 'gold', className, children }: IconCircleProps) {
  return (
    <span
      className={cn(
        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
