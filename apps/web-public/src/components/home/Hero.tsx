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

      {/* Directional navy wash — heaviest behind the RTL text (right), photo clear on the left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to left, rgba(11,23,38,0.95) 0%, rgba(13,26,43,0.84) 30%, rgba(13,26,43,0.42) 64%, rgba(11,23,38,0.10) 100%)',
        }}
        aria-hidden
      />
      {/* Soft cinematic vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 120% at 50% 42%, transparent 56%, rgba(11,23,38,0.45) 100%)' }}
        aria-hidden
      />
      {/* Top fade for navbar legibility */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy/70 to-transparent" aria-hidden />
      {/* Soft gold ambient glow behind the content */}
      <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
      {/* Bottom fade to anchor the SearchPanel */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-navy to-transparent" aria-hidden />

      <Container className="relative pb-28 pt-28 sm:pb-32 lg:pb-36">
        <div className="max-w-[660px]">
          <Reveal>
            <Badge tone="gold">عقارات مختارة بعناية</Badge>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 max-w-[620px] text-[2rem] font-bold leading-[1.28] text-white sm:text-4xl lg:text-5xl">
              <span className="block">استثمر في عقار</span>
              <span className="relative inline-block">
                مختار بعناية
                <span aria-hidden className="absolute inset-x-0 -bottom-1.5 h-2.5 rounded-full bg-gold-400/90 sm:h-3" />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-5 max-w-[540px] text-[17px] leading-[1.8] text-white/80 sm:text-lg">
              وحدات ومشاريع سكنية وتجارية مختارة بعناية — تناسب السكن والاستثمار.
            </p>
          </Reveal>
          <Reveal delay={230}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink
                href={routes.units}
                variant="gold"
                size="lg"
                className="shadow-[0_14px_34px_-12px_rgba(200,162,75,0.55)]"
              >
                استكشف الوحدات
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </ButtonLink>
              <ButtonLink
                href={routes.contact}
                variant="outline"
                size="lg"
                className="border-white/40 bg-white/10 text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/[0.18]"
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
