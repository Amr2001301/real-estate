import { Gem, Layers, Scale, Users, Sparkles, Bell } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const ICONS = [Gem, Layers, Scale, Users, Sparkles, Bell] as const;

const GLOW = { background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.14), transparent 60%)' } as const;

export function WhyChooseUs({ locale }: { locale: Locale }) {
  const m = siteT(locale).home.why;

  return (
    <Section tone="canvas" className="py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-gold-100/70 px-3 py-1 text-sm font-semibold text-gold-600 sm:text-base">
          {m.eyebrow}
        </span>
        <h2 className="mt-4 text-3xl font-bold text-ink-strong lg:text-4xl">{m.title}</h2>
        <p className="mt-2 text-ink-muted">{m.sub}</p>
      </div>

      <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={70}>
        {m.values.map((v, i) => {
          const Icon = ICONS[i]!;
          return (
            <div
              key={v.title}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-[0_0_0_3px_rgba(200,162,75,0.16),0_18px_44px_-16px_rgba(15,30,51,0.20)]"
            >
              <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />
              <div className="relative flex items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-base font-semibold leading-snug text-ink-strong">{v.title}</h3>
              </div>
              <p className="relative mt-3 text-sm leading-relaxed text-ink-muted">{v.body}</p>
            </div>
          );
        })}
      </Stagger>
    </Section>
  );
}
