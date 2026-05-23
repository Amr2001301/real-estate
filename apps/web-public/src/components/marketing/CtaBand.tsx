import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/motion/Reveal';

interface CtaBandProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Action buttons. */
  children: React.ReactNode;
}

/**
 * Contained navy CTA card on a light section — deliberately NOT a full-bleed
 * navy band, so pages don't end with two stacked dark blocks (CTA + footer).
 */
export function CtaBand({ eyebrow, title, description, children }: CtaBandProps) {
  return (
    <Section tone="canvas">
      <Reveal>
        <div className="relative overflow-hidden rounded-4xl bg-navy px-6 py-12 text-center shadow-card sm:px-12 sm:py-14">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(120% 150% at 82% 0%, #24426A 0%, #14273F 58%, #0B1726 100%)' }}
            aria-hidden
          />
          <span className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-gold-400/12 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            {eyebrow && <span className="text-sm font-medium tracking-wide text-gold-200">{eyebrow}</span>}
            <h2 className="mt-3 text-3xl font-bold text-white lg:text-4xl">{title}</h2>
            {description && <p className="mt-4 leading-relaxed text-white/75">{description}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{children}</div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
