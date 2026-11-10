import { Check, Phone } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/components/contact/ContactForm';
import { telHref, whatsappHref } from '@/lib/contact';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';


/**
 * «خلّينا نرشح لك العقار الأنسب»: the pitch, three promises and the company's
 * own call / WhatsApp tiles on one side, the consultation form on the other.
 * A tile shows only when the company set that number.
 */
export function HomeContact({
  locale,
  phone,
  whatsapp,
}: {
  locale: Locale;
  phone?: string | null;
  whatsapp?: string | null;
}) {
  const m = siteT(locale).home.contact;

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col overflow-hidden rounded-[2rem] border border-hairline bg-surface lg:flex-row">
          <div className="flex-1 bg-navy/[0.07] px-6 py-10 sm:px-10 lg:px-14 lg:py-14 dark:bg-navy/25">
            <span className="inline-flex rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-navy dark:text-gold-300">{m.badge}</span>
            <h2 className="mt-5 text-[2rem] font-semibold leading-[1.4] text-ink-strong sm:text-[2.5rem]">
              {m.title1}
              <br />
              <span className="text-navy dark:text-gold-300">{m.titleHighlight}</span>
            </h2>
            <p className="mt-3 max-w-md text-[17px] leading-[1.9] text-ink-muted">{m.desc}</p>

            <ul className="mt-7 space-y-3.5">
              {m.features.map((p) => (
                <li key={p} className="flex items-center gap-3 text-ink-strong">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-[15px] sm:text-base">{p}</span>
                </li>
              ))}
            </ul>

            {(phone || whatsapp) && (
              <div className="mt-9 flex flex-wrap gap-3">
                {phone && (
                  <a href={telHref(phone)} className="flex min-h-[68px] flex-1 basis-56 items-center gap-3.5 rounded-2xl border border-hairline bg-surface px-4 py-3 transition-colors hover:border-navy/40">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                      <Phone className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs text-ink-muted">{m.callUs}</span>
                      <span className="text-[17px] font-semibold text-ink-strong">{m.callNow}</span>
                    </span>
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={whatsappHref(whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[68px] flex-1 basis-56 items-center gap-3.5 rounded-2xl border border-hairline bg-surface px-4 py-3 transition-colors hover:border-[#1FAF55]/50"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1FAF55] text-white">
                      <WhatsAppIcon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs text-ink-muted">{m.whatsapp}</span>
                      <span className="text-[17px] font-semibold text-ink-strong">{m.whatsappNow}</span>
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
            <ContactForm context={{}} eyebrow={m.formEyebrow} locale={locale} />
          </div>
        </div>
      </Container>
    </section>
  );
}
