import { Check, Phone } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/components/contact/ContactForm';
import { telHref, whatsappHref } from '@/lib/contact';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

/** WhatsApp's official mark (the phone in a speech bubble), filled. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
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
