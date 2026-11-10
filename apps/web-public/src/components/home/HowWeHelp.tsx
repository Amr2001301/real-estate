import { Container } from '@/components/ui/Container';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { SectionHead } from './SectionHead';

/** «رحلتك العقارية في 4 خطوات»: four numbered cards, the last in the company colour. */
export function HowWeHelp({ locale }: { locale: Locale }) {
  const m = siteT(locale).home.howWeHelp;
  const last = m.steps.length - 1;

  return (
    <section className="pt-20 sm:pt-28">
      <Container>
        <SectionHead eyebrow={m.eyebrow} title={m.title} sub={m.sub} center />
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {m.steps.map((step, i) => (
            <li
              key={step.title}
              className={cn(
                'rounded-3xl border px-6 py-8',
                i === last ? 'border-navy bg-navy text-white' : 'border-hairline bg-surface',
              )}
            >
              <div className="flex items-center gap-4">
                <span className={cn('font-display text-[2.875rem] font-semibold leading-none', i === last ? 'text-gold-300' : 'text-navy dark:text-gold-300')}>
                  {step.num}
                </span>
                <span className={cn('h-px flex-1', i === last ? 'bg-white/30' : 'bg-hairline')} aria-hidden />
              </div>
              <h3 className={cn('mt-5 text-xl font-semibold', i === last ? 'text-white' : 'text-ink-strong')}>{step.title}</h3>
              <p className={cn('mt-2 text-[15px] leading-relaxed', i === last ? 'text-white/85' : 'text-ink-muted')}>{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
