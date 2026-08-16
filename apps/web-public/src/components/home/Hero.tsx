import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

interface HeroProps {
  image?: string | null;
  projectsCount?: number | null;
  unitsCount?: number | null;
  locale: Locale;
}

export function Hero({ image, projectsCount, unitsCount, locale }: HeroProps) {
  const m = siteT(locale).home.hero;
  const showProjects = projectsCount != null && projectsCount > 0;
  const showUnits = unitsCount != null && unitsCount > 0;
  const hasStats = showProjects || showUnits;

  return (
    <section className="relative flex min-h-[480px] items-center overflow-hidden bg-navy sm:min-h-[520px] lg:min-h-[580px]">
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
      {/* Directional wash — heavy on the right behind Arabic text */}
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

      <Container className="relative pb-14 pt-24 sm:pb-16 lg:pb-20">
        <div className="max-w-[660px]">

          {/* Eyebrow — dot + all-caps tracking label */}
          <Reveal>
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-400">
                {m.eyebrow}
              </span>
            </div>
          </Reveal>

          {/* Headline — light supporting line + bold hero line with gradient word */}
          <Reveal delay={80}>
            <h1 className="mt-7 text-[2.5rem] leading-[1.2] sm:text-5xl lg:text-[3.75rem]">
              <span className="block font-light tracking-tight text-white/75">
                {m.line1}
              </span>
              <span className="block font-extrabold tracking-tight text-white">
                {m.line2}{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(to left, #b8923e, #f0d080, #d4a84b)' }}
                >
                  {m.highlight}
                </span>
              </span>
            </h1>
          </Reveal>

          {/* Thin gold separator — visual chapter break */}
          <div className="mt-8 h-px w-12 bg-gold-400/40" aria-hidden />

          {/* Description */}
          <Reveal delay={150}>
            <p className="mt-5 max-w-[480px] text-[16px] leading-[1.9] text-white/55 sm:text-[17px]">
              {m.sub}
            </p>
          </Reveal>

          {/* Stats — large numeral + small uppercase label, separated by vertical rule */}
          {hasStats && (
            <Reveal delay={210}>
              <div className="mt-9 flex items-center gap-7">
                {showProjects && (
                  <div>
                    <div className="font-display text-[1.9rem] font-black leading-none text-white">
                      {projectsCount}+
                    </div>
                    <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      {m.projects}
                    </div>
                  </div>
                )}
                {showProjects && showUnits && (
                  <div className="h-9 w-px bg-white/15" aria-hidden />
                )}
                {showUnits && (
                  <div>
                    <div className="font-display text-[1.9rem] font-black leading-none text-white">
                      {unitsCount}+
                    </div>
                    <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      {m.units}
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          )}

          {/* CTAs — gold primary + icon-circle text secondary */}
          <Reveal delay={270}>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <ButtonLink
                href={routes.units}
                variant="gold"
                size="lg"
                className="shadow-[0_16px_40px_-12px_rgba(200,162,75,0.55)]"
              >
                {m.cta1}
              </ButtonLink>

              <Link
                href={routes.contact}
                className="group inline-flex items-center gap-3 text-[15px] font-medium text-white/60 transition-colors duration-200 hover:text-white/90"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.07] backdrop-blur-sm transition-all duration-200 group-hover:border-white/40 group-hover:bg-white/[0.14]">
                  <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {m.cta2}
              </Link>
            </div>
          </Reveal>

        </div>
      </Container>
    </section>
  );
}
