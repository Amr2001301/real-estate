import { ArrowLeft, MessageCircle } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/motion/Reveal';

interface HeroProps {
  image?: string | null;
  /** Accepted for compatibility with the page feed; not rendered in the hero. */
  projectsCount?: number | null;
  unitsCount?: number | null;
}

export function Hero({ image }: HeroProps) {
  return (
    <section className="relative flex min-h-[500px] items-center overflow-hidden bg-navy sm:min-h-[540px] lg:min-h-[600px]">
      {/* Architectural photo (full-bleed, visible) — or a navy depth gradient fallback */}
      {image ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-80 motion-safe:animate-ken-burns"
          style={{ backgroundImage: `url(${image})` }}
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(130% 120% at 80% 10%, #24426A 0%, #14273F 55%, #0B1726 100%)' }}
          aria-hidden
        />
      )}

      {/* Directional navy wash — heaviest on the RTL text side (right), clear photo on the left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to left, rgba(11,23,38,0.94) 0%, rgba(13,26,43,0.82) 32%, rgba(13,26,43,0.40) 66%, rgba(11,23,38,0.12) 100%)',
        }}
        aria-hidden
      />
      {/* Top fade for navbar legibility */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy/70 to-transparent" aria-hidden />
      {/* Soft gold ambient glow behind the content (subtle warmth, not clutter) */}
      <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
      {/* Bottom fade so the SearchPanel blends into the hero base */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-navy to-transparent" aria-hidden />

      <Container className="relative pb-28 pt-28 sm:pb-32 lg:pb-36">
        <div className="max-w-[660px]">
          <Reveal>
            <Badge tone="gold">دار الفخامة</Badge>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 text-balance text-[2rem] font-bold leading-[1.3] text-white sm:text-4xl lg:text-5xl">
              استثمر في عقار مختار بعناية
            </h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-5 max-w-[600px] text-[17px] leading-[1.8] text-white/80 sm:text-lg">
              مشاريع ووحدات سكنية وتجارية مختارة بعناية لتناسب السكن والاستثمار.
            </p>
          </Reveal>
          <Reveal delay={230}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href={routes.units} variant="gold" size="lg">
                استكشف الوحدات
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </ButtonLink>
              <ButtonLink
                href={routes.contact}
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:border-white/60 hover:bg-white/5"
              >
                <MessageCircle className="h-5 w-5" aria-hidden />
                تحدث مع مستشار
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
