import Link from 'next/link';
import type { Route } from 'next';
import { ChevronLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { CoverImage } from '@/components/ui/CoverImage';
import { Reveal } from '@/components/motion/Reveal';
import { cityLabel, formatNumber, pickAr } from '@/lib/format';
import type { PublicProjectListItem } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

interface HeroProps {
  /** The project shown on the photo side (the first featured one). */
  featured?: PublicProjectListItem | null;
  projectsCount?: number | null;
  unitsCount?: number | null;
  citiesCount?: number | null;
  locale: Locale;
}

/** The company's deep colour: its primary darkened, behind white text. */
export const DEEP_BG = 'color-mix(in srgb, rgb(var(--c-navy)) 50%, black)';

/**
 * The homepage hero: a rounded panel in the company's deep colour — headline,
 * two calls to action and the live counts on one side, the featured project's
 * cover with a small card on the other.
 */
export function Hero({ featured, projectsCount, unitsCount, citiesCount, locale }: HeroProps) {
  const m = siteT(locale).home.hero;
  const all: Array<{ value: number | null | undefined; label: string }> = [
    { value: projectsCount, label: m.projects },
    { value: unitsCount, label: m.units },
    { value: citiesCount, label: m.cities },
  ];
  const stats = all.filter((s): s is { value: number; label: string } => s.value != null && s.value > 0);
  const name = featured ? pickAr(featured.name, '', locale) : '';

  return (
    <section className="pt-24 sm:pt-28">
      <Container>
        <div className="flex flex-col overflow-hidden rounded-[2rem] lg:min-h-[620px] lg:flex-row" style={{ background: DEEP_BG }}>
          <div className="flex flex-1 flex-col justify-center px-6 pb-24 pt-12 text-white sm:px-10 lg:px-16 lg:pb-32 lg:pt-16">
            <Reveal>
              <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-gold-300">
                <span className="h-0.5 w-7 rounded-full bg-gold-400" aria-hidden />
                {m.eyebrow}
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.45] text-white sm:text-[3rem] lg:text-[3.75rem]">
                {m.line1}
                <br />
                {m.line2} <span className="text-gold-300">{m.highlight}</span>
              </h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-5 max-w-[500px] text-[17px] font-light leading-[1.95] text-white/80 sm:text-lg">{m.sub}</p>
            </Reveal>
            <Reveal delay={210}>
              <div className="mt-9 flex flex-wrap gap-3.5">
                <ButtonLink href={routes.units} variant="gold" size="lg" className="gap-2 text-[#1B1206]">
                  {m.cta1}
                  <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
                </ButtonLink>
                <Link
                  href={routes.contact}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/30 bg-white/[0.08] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/[0.14]"
                >
                  {m.cta2}
                </Link>
              </div>
            </Reveal>
            {stats.length > 0 && (
              <Reveal delay={270}>
                <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
                  {stats.map((s) => (
                    <div key={s.label} className="flex flex-col-reverse border-s-2 border-gold-400 ps-4">
                      <dt className="mt-2 text-sm text-white/70">{s.label}</dt>
                      <dd className="font-display text-[2.5rem] font-semibold leading-none">{formatNumber(s.value, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            )}
          </div>

          <div className="relative min-h-[320px] flex-1 sm:min-h-[420px] lg:min-h-0">
            <CoverImage src={featured?.coverImage} alt={name} className="absolute inset-0 h-full" />
            {featured && name && (
              <Link
                href={routes.project(featured.id) as Route}
                className="absolute start-5 top-5 w-[min(340px,calc(100%-2.5rem))] rounded-[20px] bg-white/[0.97] p-5 text-[#1A1F1C] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5 sm:start-7 sm:top-7"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-gold-400 px-3 py-1.5 text-xs font-semibold text-[#1B1206]">{m.featured}</span>
                  <span className="line-clamp-1 text-[13px] text-[#5F625C]">{cityLabel(featured.city, locale)}</span>
                </div>
                <div className="mt-3 line-clamp-1 font-display text-[22px] font-semibold">{name}</div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="text-[#5F625C]">
                    <b className="font-semibold text-[#1A1F1C]">{formatNumber(featured.availableUnitsCount, locale)}</b> {m.available}
                  </span>
                  <span className="font-semibold text-navy">{m.details} ←</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
