import { Check, Phone } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/components/contact/ContactForm';
import { telHref, whatsappHref } from '@/lib/contact';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { DEEP_BG } from '@/components/home/Hero';


/**
 * «خلّينا نرشح لك العقار الأنسب»: on a photo of one of the company's projects
 * under its deep colour, the pitch, three promises, its office hours and its
 * own call / WhatsApp tiles at the foot; the consultation form on the other
 * side. A tile shows only when the company set that number.
 */
export function HomeContact({
  locale,
  phone,
  whatsapp,
  image,
  hours,
}: {
  locale: Locale;
  phone?: string | null;
  whatsapp?: string | null;
  /** A photo of one of the company's projects; the site's own picture when it has none. */
  image?: string | null;
  /** The company's office hours, in the visitor's language, when it set them. */
  hours?: string | null;
}) {
  const m = siteT(locale).home.contact;

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col overflow-hidden rounded-[2rem] border border-hairline bg-surface lg:flex-row">
          <div className="relative isolate flex flex-1 flex-col overflow-hidden px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image || '/images/home/why.jpg'} alt="" loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <span
              className="absolute inset-0 -z-10"
              style={{ background: `linear-gradient(160deg, ${DEEP_BG} 0%, color-mix(in srgb, rgb(var(--c-navy)) 60%, transparent) 100%)` }}
              aria-hidden
            />
            <span className="inline-flex self-start rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy">{m.badge}</span>
            <h2 className="mt-5 text-[2rem] font-semibold leading-[1.4] text-white sm:text-[2.5rem]">
              {m.title1}
              <br />
              <span className="text-gold-300">{m.titleHighlight}</span>
            </h2>
            <p className="mt-3 max-w-md text-[17px] leading-[1.9] text-white/75">{m.desc}</p>

            <ul className="mt-7 space-y-3.5">
              {m.features.map((p) => (
                <li key={p} className="flex items-center gap-3 text-white">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[#1B1206]">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-[15px] sm:text-base">{p}</span>
                </li>
              ))}
            </ul>

            {hours && (
              <p className="mt-7 flex items-center gap-2 text-sm text-white/75">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                {m.hours(hours)}
              </p>
            )}

            {(phone || whatsapp) && (
              <div className="mt-auto flex flex-wrap gap-3 pt-10">
                {phone && (
                  <a href={telHref(phone)} className="flex min-h-[68px] flex-1 basis-56 items-center gap-3.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md transition-colors hover:bg-white/15">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-[#1B1206]">
                      <Phone className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs text-white/70">{m.callUs}</span>
                      <span className="text-[17px] font-semibold text-white">{m.callNow}</span>
                    </span>
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={whatsappHref(whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[68px] flex-1 basis-56 items-center gap-3.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md transition-colors hover:bg-white/15"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1FAF55] text-white">
                      <WhatsAppIcon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs text-white/70">{m.whatsapp}</span>
                      <span className="text-[17px] font-semibold text-white">{m.whatsappNow}</span>
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
