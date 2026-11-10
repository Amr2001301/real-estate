import { Check, Phone } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/components/contact/ContactForm';
import { telHref, whatsappHref } from '@/lib/contact';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

/** WhatsApp's mark (brand glyph, filled). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm0 17.2a7.7 7.7 0 0 1-3.9-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 1 1 12 19.7zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.2z" />
    </svg>
  );
}

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
                      <bdi dir="ltr" className="text-[17px] font-semibold text-ink-strong">{phone}</bdi>
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
