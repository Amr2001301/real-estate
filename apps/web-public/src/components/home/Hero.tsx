import { MessageCircle, Building2, Home } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/motion/Reveal';

interface HeroProps {
  image?: string | null;
  projectsCount?: number | null;
  unitsCount?: number | null;
}

export function Hero({ image, projectsCount, unitsCount }: HeroProps) {
  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden bg-navy sm:min-h-[620px] lg:min-h-[700px]">
      {/* Background photo or radial gradient fallback */}
      {image ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-75 motion-safe:animate-ken-burns"
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

      {/* Directional wash — heavy on the right behind Arabic text, clear on left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to left, rgba(11,23,38,0.96) 0%, rgba(13,26,43,0.85) 28%, rgba(13,26,43,0.44) 62%, rgba(11,23,38,0.08) 100%)' }}
        aria-hidden
      />
      {/* Cinematic vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 120% at 50% 42%, transparent 54%, rgba(11,23,38,0.50) 100%)' }}
        aria-hidden
      />
      {/* Top fade for nav legibility */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-navy/75 to-transparent" aria-hidden />
      {/* Gold ambient glow */}
      <div className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-gold-400/12 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-1/3 top-1/2 h-64 w-64 rounded-full bg-gold-400/6 blur-2xl" aria-hidden />
      {/* Bottom fade anchors the SearchPanel */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-navy to-transparent" aria-hidden />

      <Container className="relative pb-20 pt-28 sm:pb-24 lg:pb-28">
        <div className="max-w-[680px]">
          <Reveal>
            <Badge tone="gold">عقارات مختارة بعناية</Badge>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-5 max-w-[640px] text-[2.1rem] font-bold leading-[1.25] text-white sm:text-4xl lg:text-[3.25rem]">
              <span className="block">استثمر في عقار</span>
              <span className="relative inline-block">
                مختار بعناية
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1.5 h-2.5 rounded-full bg-gold-400/90 sm:h-3"
                />
              </span>
            </h1>
          </Reveal>

          <Reveal delay={150}>
            <p className="mt-5 max-w-[520px] text-[17px] leading-[1.85] text-white/80 sm:text-lg">
              وحدات ومشاريع سكنية وتجارية مختارة بعناية — تناسب السكن والاستثمار.
            </p>
          </Reveal>

          {/* Live stats chips */}
          {(projectsCount != null || unitsCount != null) && (
            <Reveal delay={210}>
              <div className="mt-6 flex flex-wrap gap-3">
                {projectsCount != null && projectsCount > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                    <Building2 className="h-4 w-4 text-gold-300" aria-hidden />
                    {projectsCount}+ مشروع
                  </span>
                )}
                {unitsCount != null && unitsCount > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                    <Home className="h-4 w-4 text-gold-300" aria-hidden />
                    {unitsCount}+ وحدة
                  </span>
                )}
              </div>
            </Reveal>
          )}

          <Reveal delay={270}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink
                href={routes.units}
                variant="gold"
                size="lg"
                className="shadow-[0_14px_34px_-12px_rgba(200,162,75,0.60)]"
              >
                استكشف الوحدات
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
