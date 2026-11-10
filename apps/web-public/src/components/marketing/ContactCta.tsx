import Link from 'next/link';
import type { Route } from 'next';
import { Phone } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { companyContact, telHref, whatsappHref } from '@/lib/contact';
import { routes } from '@/lib/routes';
import type { BrandingData } from '@/lib/branding';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { DEEP_BG } from '@/components/home/Hero';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

/**
 * «محتار في الاختيار؟» — the closing call to action of the listing pages: the
 * company's deep colour, a photo at the far end, and two real buttons (call,
 * WhatsApp) with the company's own numbers behind them; the number itself is
 * not printed. Falls back to the contact page when the company set neither.
 */
export function ContactCta({ locale, branding, image }: { locale: Locale; branding?: BrandingData | null; image?: string | null }) {
  const m = siteT(locale).contactCta;
  const { phone, whatsapp } = companyContact(branding);
  const hours = branding?.officeHours?.[locale];

  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="flex flex-col overflow-hidden rounded-[1.75rem] text-white lg:min-h-[340px] lg:flex-row" style={{ background: DEEP_BG }}>
          <div className="relative order-first h-48 lg:order-last lg:h-auto lg:flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image || '/images/home/why.jpg'} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            {/* The photo fades into the panel: from below on a phone, from the text side on a wide screen. */}
            <span className="absolute inset-0 lg:hidden" style={{ background: `linear-gradient(to top, ${DEEP_BG} 0%, transparent 60%)` }} aria-hidden />
            <span
              className="absolute inset-0 hidden lg:block"
              style={{ background: `linear-gradient(to ${locale === 'ar' ? 'left' : 'right'}, ${DEEP_BG} 0%, transparent 35%)` }}
              aria-hidden
            />
          </div>
          <div className="flex flex-col justify-center px-6 pb-8 pt-6 sm:px-12 sm:py-12 lg:flex-[1.25]">
            <span className="self-start rounded-full bg-gold-400/20 px-3.5 py-1.5 text-[13px] font-semibold text-gold-300">{m.badge}</span>
            <h2 className="mt-4 text-[1.625rem] font-semibold leading-[1.45] text-white sm:text-[2.125rem]">{m.title}</h2>
            <p className="mt-2 max-w-xl text-[15px] font-light leading-[1.9] text-white/80 sm:text-[17px]">{m.sub}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {phone && (
                <a href={telHref(phone)} className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gold-400 px-6 text-base font-semibold text-[#1B1206] transition-colors hover:bg-gold-300">
                  <Phone className="h-5 w-5" aria-hidden />
                  {m.call}
                </a>
              )}
              {whatsapp && (
                <a
                  href={whatsappHref(whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#1FAF55] px-6 text-base font-semibold text-white transition-colors hover:bg-[#1a9a4b]"
                >
                  <WhatsAppIcon className="h-[22px] w-[22px]" />
                  {m.whatsapp}
                </a>
              )}
              {!phone && !whatsapp && (
                <Link href={routes.contact as Route} className="inline-flex h-14 items-center justify-center rounded-2xl bg-gold-400 px-6 text-base font-semibold text-[#1B1206]">
                  {m.contact}
                </Link>
              )}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <span className="h-2 w-2 rounded-full bg-[#4ADE80] shadow-[0_0_0_4px_rgba(74,222,128,0.18)]" aria-hidden />
              {hours ? `${hours} · ${m.noCommitment}` : m.noCommitment}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
