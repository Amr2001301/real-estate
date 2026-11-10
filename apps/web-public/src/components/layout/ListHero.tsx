import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/motion/Reveal';
import { routes } from '@/lib/routes';
import { DEEP_BG } from '@/components/home/Hero';

export interface ListHeroStat {
  value: string;
  label: string;
}

/**
 * The header of a listing page (projects, units): a rounded panel in the
 * company's deep colour, in the homepage hero's look — breadcrumb, title, one
 * line, and live figures at the far end. Leaves room at the bottom for the
 * filter bar that overlaps it.
 */
export function ListHero({
  homeLabel,
  title,
  subtitle,
  stats = [],
}: {
  homeLabel: string;
  title: string;
  subtitle?: string;
  stats?: ListHeroStat[];
}) {
  return (
    <section className="pt-24 sm:pt-28">
      <Container>
        <div
          className="relative overflow-hidden rounded-[1.75rem] px-6 pb-24 pt-9 text-white sm:px-12 sm:pb-28 sm:pt-11"
          style={{ background: DEEP_BG }}
        >
          <span
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(60% 120% at 0% 0%, rgb(var(--c-gold-400) / 0.18), transparent 60%)' }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <Reveal>
              <nav aria-label="breadcrumb" className="text-sm text-white/65">
                <Link href={routes.home} className="hover:text-white">{homeLabel}</Link>
                <span className="mx-2" aria-hidden>/</span>
                <span className="font-medium text-white" aria-current="page">{title}</span>
              </nav>
              <h1 className="mt-3 text-[2.25rem] font-semibold leading-[1.4] text-white sm:text-[3rem]">{title}</h1>
              {subtitle && <p className="mt-2 max-w-xl text-[17px] font-light leading-[1.9] text-white/80">{subtitle}</p>}
            </Reveal>
            {stats.length > 0 && (
              <dl className="flex flex-wrap gap-x-9 gap-y-4">
                {stats.map((s) => (
                  <div key={s.label} className="flex flex-col-reverse border-s-2 border-gold-400 ps-3.5">
                    <dt className="mt-1.5 text-[13px] text-white/70">{s.label}</dt>
                    <dd className="font-display text-[2.125rem] font-semibold leading-none">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
