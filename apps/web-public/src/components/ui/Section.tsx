import { cn } from '@/lib/cn';
import { Container } from './Container';

type Tone = 'canvas' | 'surface' | 'soft' | 'navy';

const TONES: Record<Tone, string> = {
  canvas: 'bg-canvas text-ink',
  surface: 'bg-surface text-ink',
  soft: 'bg-surface-soft text-ink',
  // Dark navy — reserved for cinematic / CTA moments only.
  navy: 'bg-navy text-white',
};

interface SectionProps {
  tone?: Tone;
  className?: string;
  containerClassName?: string;
  /** When false, children render full-bleed without the inner Container. */
  contained?: boolean;
  children: React.ReactNode;
}

/** Editorial vertical band with generous, premium spacing. */
export function Section({
  tone = 'canvas',
  className,
  containerClassName,
  contained = true,
  children,
}: SectionProps) {
  return (
    <section className={cn('py-14 sm:py-16 lg:py-24', TONES[tone], className)}>
      {contained ? <Container className={containerClassName}>{children}</Container> : children}
    </section>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'start' | 'center';
  invert?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'start',
  invert = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            'mb-3 inline-block text-sm font-medium tracking-wide',
            invert ? 'text-gold-200' : 'text-gold-500',
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2 className={cn('text-display-2', invert && 'text-white')}>{title}</h2>
      {description && (
        <p className={cn('mt-4 text-lg leading-relaxed', invert ? 'text-white/75' : 'text-ink-muted')}>
          {description}
        </p>
      )}
    </div>
  );
}
