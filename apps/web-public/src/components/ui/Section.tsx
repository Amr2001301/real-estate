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

/** Editorial vertical band — compact, premium default spacing across the site. */
export function Section({
  tone = 'canvas',
  className,
  containerClassName,
  contained = true,
  children,
}: SectionProps) {
  return (
    <section className={cn('py-10 sm:py-12 lg:py-16', TONES[tone], className)}>
      {contained ? <Container className={containerClassName}>{children}</Container> : children}
    </section>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  align?: 'start' | 'center';
  invert?: boolean;
  className?: string;
  /** Heading level for the title. Defaults to h2; pages that need a single
   *  document-level title (and the e2e level-1 assertions) pass 'h1'. */
  as?: 'h1' | 'h2';
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'start',
  invert = false,
  className,
  as: Heading = 'h2',
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
      <Heading className={cn('text-3xl font-bold lg:text-4xl', invert && 'text-white')}>{title}</Heading>
      {description && (
        <p className={cn('mt-2 leading-relaxed', invert ? 'text-white/75' : 'text-ink-muted')}>
          {description}
        </p>
      )}
    </div>
  );
}
