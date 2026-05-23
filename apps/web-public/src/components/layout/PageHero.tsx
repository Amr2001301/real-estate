import { Container } from '@/components/ui/Container';
import { Divider } from '@/components/ui/Divider';
import { Reveal } from '@/components/motion/Reveal';

export interface PageHeroStat {
  value: string;
  label: string;
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats?: PageHeroStat[];
}

/**
 * Slim, elegant inner-page hero. Navy band (not full-screen) — keeps the
 * transparent top navbar readable and stays consistent with the brand's
 * "dark moments" while leaving the rest of the page light.
 */
export function PageHero({ eyebrow, title, subtitle, stats }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-navy">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 140% at 85% 0%, #24426A 0%, #14273F 55%, #0B1726 100%)' }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />

      <Container className="relative pb-10 pt-24 sm:pb-12 sm:pt-28">
        <Reveal>
          <div className="max-w-2xl">
            {eyebrow && <span className="text-sm font-medium tracking-wide text-gold-200">{eyebrow}</span>}
            <Divider accent className="mb-5 mt-3" />
            <h1 className="text-display-1 text-white">{title}</h1>
            {subtitle && <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">{subtitle}</p>}

            {stats && stats.length > 0 && (
              <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-6 border-t border-white/10 pt-6">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="font-display text-2xl text-gold-200">{s.value}</dt>
                    <dd className="mt-1 text-sm text-white/65">{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
