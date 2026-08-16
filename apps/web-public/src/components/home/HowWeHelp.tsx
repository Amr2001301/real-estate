import { Search, Scale, CalendarCheck, KeyRound } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const ICONS = [Search, Scale, CalendarCheck, KeyRound] as const;

export function HowWeHelp({ locale }: { locale: Locale }) {
  const m = siteT(locale).home.howWeHelp;

  return (
    <Section tone="canvas" className="py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-gold-100/70 px-3 py-1 text-sm font-semibold text-gold-600 sm:text-base">
          {m.eyebrow}
        </span>
        <h2 className="mt-3 text-2xl font-bold leading-tight text-ink-strong sm:text-3xl lg:text-[2.35rem]">{m.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted sm:text-base">{m.sub}</p>
      </div>

      <div className="relative mt-8">
        <span
          aria-hidden
          className="absolute inset-x-8 top-12 hidden h-px bg-gradient-to-l from-transparent via-gold-200/60 to-transparent lg:block"
        />
        <Stagger
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
          childClassName="h-full"
          step={80}
        >
          {m.steps.map((step, i) => {
            const Icon = ICONS[i]!;
            return (
              <div
                key={step.title}
                className="group relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface px-5 py-5 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute end-5 top-4 font-display text-4xl font-bold leading-none text-gold-300"
                >
                  {step.num}
                </span>
                <div className="relative flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-semibold text-ink-strong">{step.title}</h3>
                </div>
                <p className="relative mt-3 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            );
          })}
        </Stagger>
      </div>
    </Section>
  );
}
