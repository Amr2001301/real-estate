import { Check, Headset } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ContactForm } from '@/components/contact/ContactForm';
import { getContactPhone, telHref } from '@/lib/contact';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const DOTS = {
  backgroundImage: 'radial-gradient(rgba(15,30,51,0.06) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
} as const;

export function HomeContact({ locale }: { locale: Locale }) {
  const m = siteT(locale).home.contact;
  const contactPhone = getContactPhone();

  return (
    <section className="py-10 sm:py-12 lg:py-14">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-gold-200/60 bg-gradient-to-bl from-gold-100 via-gold-50 to-surface-soft px-5 py-8 shadow-card sm:px-8 sm:py-10 lg:px-12 lg:py-12 dark:border-gold-300/20 dark:from-navy-700 dark:via-navy dark:to-surface">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={DOTS} />
          <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl dark:bg-gold-500/20" />

          <div className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <Badge tone="navy">{m.badge}</Badge>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-ink-strong lg:text-4xl">
                {m.title1}{' '}
                <span className="relative inline-block whitespace-nowrap">
                  {m.titleHighlight}
                  <span aria-hidden className="absolute inset-x-0 -bottom-1 h-2.5 rounded-full bg-gold-300/80 sm:h-3" />
                </span>
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
                {m.desc}
              </p>

              <ul className="mt-7 space-y-3">
                {m.features.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-ink-strong">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600 ring-1 ring-gold-200/70">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="text-sm sm:text-base">{p}</span>
                  </li>
                ))}
              </ul>

              {contactPhone && (
                <a
                  href={telHref(contactPhone)}
                  className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-[15px] font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-navy-700"
                >
                  <Headset className="h-5 w-5 text-gold-300" aria-hidden />
                  {m.cta}
                </a>
              )}
            </div>

            <div>
              <ContactForm context={{}} eyebrow={m.formEyebrow} locale={locale} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
