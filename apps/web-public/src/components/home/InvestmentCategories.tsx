import Link from 'next/link';
import type { Route } from 'next';
import { Home, Briefcase, Store, Stethoscope, Hotel } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const ICONS = [Home, Briefcase, Store, Stethoscope, Hotel] as const;

const HREFS = [
  routes.units,
  `${routes.units}?type=office`,
  `${routes.units}?type=retail`,
  routes.units,
  routes.units,
] as const;

const GLOW = { background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.16), transparent 58%)' } as const;

export function InvestmentCategories({ locale }: { locale: Locale }) {
  const m = siteT(locale).home.categories;

  return (
    <Section tone="canvas" className="py-10 sm:py-12 lg:py-14">
      <div className="rounded-3xl border border-hairline bg-surface-soft p-6 shadow-card sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink-strong lg:text-4xl">{m.title}</h2>
          <p className="mt-2 text-ink-muted">{m.sub}</p>
        </div>

        <Stagger
          className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5"
          childClassName="h-full"
          step={60}
        >
          {m.items.map((item, i) => {
            const Icon = ICONS[i]!;
            const href = HREFS[i]!;
            return (
              <Link
                key={item.title}
                href={href as Route}
                className="group relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface p-5 text-center shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1.5 hover:border-gold-300 hover:shadow-[0_0_0_3px_rgba(200,162,75,0.18),0_18px_48px_-16px_rgba(15,30,51,0.22)] sm:h-44"
              >
                <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />
                <div className="relative flex flex-col items-center gap-2.5">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:scale-105 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
                    <Icon className="h-7 w-7" aria-hidden />
                  </span>
                  <h3 className="text-lg font-bold leading-none text-ink-strong">{item.title}</h3>
                  <p className="text-xs text-ink-muted">{item.sub}</p>
                  <span className="mt-0.5 text-xs font-semibold text-ink-muted transition-colors group-hover:text-gold-600">
                    {m.browse}
                  </span>
                </div>
              </Link>
            );
          })}
        </Stagger>
      </div>
    </Section>
  );
}
