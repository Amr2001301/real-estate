import { Info } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { formatNumber } from '@/lib/format';
import type { Locale } from '@/lib/locale';

/**
 * Privacy / terms: the listings' header, then the text as numbered sections
 * beside a sticky table of contents — a document you can find your way in.
 */
export function LegalPage({
  homeLabel,
  title,
  subtitle,
  notice,
  intro,
  sections,
  tocLabel,
  locale,
}: {
  homeLabel: string;
  title: string;
  subtitle: string;
  notice?: string;
  intro?: string;
  sections: { title: string; body: string }[];
  tocLabel: string;
  locale: Locale;
}) {
  return (
    <>
      <ListHero homeLabel={homeLabel} title={title} subtitle={subtitle} />
      <section className="relative z-10 -mt-16 pb-20 sm:-mt-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <nav className="sticky top-28 rounded-[1.5rem] border border-hairline bg-surface p-6" aria-label={tocLabel}>
                <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{tocLabel}</p>
                <ol className="mt-4 space-y-1">
                  {sections.map((s, i) => (
                    <li key={s.title}>
                      <a href={`#s${i + 1}`} className="flex gap-3 rounded-xl px-3 py-2.5 text-[15px] text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink-strong">
                        <span className="font-display font-semibold text-gold-600">{formatNumber(i + 1, locale)}</span>
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
            <article className="rounded-[1.75rem] border border-hairline bg-surface p-7 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-12">
              {notice && (
                <p className="mb-8 flex items-start gap-3 rounded-2xl bg-gold-400/10 px-5 py-4 text-[15px] text-ink">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden />
                  {notice}
                </p>
              )}
              {intro && <p className="font-display text-[1.25rem] font-medium leading-[1.9] text-ink-strong">{intro}</p>}
              <div className="mt-4 divide-y divide-hairline">
                {sections.map((s, i) => (
                  <section key={s.title} id={`s${i + 1}`} className="scroll-mt-28 py-8">
                    <h2 className="flex items-baseline gap-4 font-display text-[1.45rem] font-semibold text-ink-strong">
                      <span className="text-gold-500">{formatNumber(i + 1, locale).padStart(2, '0')}</span>
                      {s.title}
                    </h2>
                    <p className="mt-3 text-[16px] leading-[2] text-ink-muted">{s.body}</p>
                  </section>
                ))}
              </div>
            </article>
          </div>
        </Container>
      </section>
    </>
  );
}
