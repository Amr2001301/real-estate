import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/motion/Reveal';

interface CtaBandProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Action buttons. */
  children: React.ReactNode;
}

// Faint texture so the navy never reads as a flat block.
const DOTS = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
} as const;

/**
 * Contained navy CTA card on a light section — deliberately NOT a full-bleed
 * navy band, so pages don't end with two stacked dark blocks (CTA + footer).
 */
export function CtaBand({ eyebrow, title, description, children }: CtaBandProps) {
  return (
    <Section tone="canvas">
      <Reveal>
        <div className="relative overflow-hidden rounded-4xl bg-navy px-6 py-12 text-center shadow-lift sm:px-12 sm:py-14">
          {/* Depth + warmth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(120% 150% at 82% 0%, #24426A 0%, #14273F 58%, #0B1726 100%)' }}
            aria-hidden
          />
          <span className="pointer-events-none absolute inset-0" style={DOTS} aria-hidden />
          <span className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-gold-400/14 blur-3xl" aria-hidden />
          <span className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
          {/* Top gold hairline accent */}
          <span className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-l from-transparent via-gold-400/55 to-transparent" aria-hidden />

          <div className="relative mx-auto max-w-2xl">
            {eyebrow && (
              <span className="inline-flex items-center rounded-full bg-gold-400/15 px-3.5 py-1 text-sm font-semibold text-gold-200 ring-1 ring-gold-400/25 backdrop-blur">
                {eyebrow}
              </span>
            )}
            <h2 className="mt-4 text-3xl font-bold leading-tight text-white lg:text-4xl">{title}</h2>
            {description && <p className="mt-4 leading-relaxed text-white/75">{description}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{children}</div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
