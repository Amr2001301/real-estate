import { CompanyMark } from './CompanyMark';
import Link from 'next/link';
import type { Route } from 'next';
import { Phone, Mail, MapPin, Clock, CalendarDays } from 'lucide-react';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import { getContactPhone, getContactEmail, telHref, whatsappHref } from '@/lib/contact';
import { companyApp } from '@/lib/app-links';
import { companyName, type BrandingData } from '@/lib/branding';
import type { PublicPageLink } from '@/lib/cms';
import { Container } from '@/components/ui/Container';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { DEEP_BG } from '@/components/home/Hero';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { FooterSwitch } from './FooterSwitch';
import { SocialIcon, SOCIAL_ORDER } from './SocialIcon';

const YEAR = new Date().getFullYear();

/** A translatable branding text: the API may send it already flattened to the visitor's language. */
function pickText(v: unknown, locale: Locale): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (v && typeof v === 'object') return ((v as Record<string, string | undefined>)[locale] ?? '').trim() || undefined;
  return undefined;
}

function FooterLink({ href, label, external = false }: { href: string; label: React.ReactNode; external?: boolean }) {
  const cls = 'inline-flex w-fit items-center text-[15px] text-white/70 transition-colors hover:text-white';
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ) : (
    <Link href={href as Route} className={cls}>
      {label}
    </Link>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 font-display text-[15px] font-semibold text-white">{children}</h2>;
}

/** Whether a published page is the privacy policy or the terms, which the legal row already links. */
function isLegalPage(p: PublicPageLink, m: ReturnType<typeof siteT>): boolean {
  const slug = p.slug.toLowerCase();
  return /privacy|terms|خصوصية|شروط/.test(slug) || p.title === m.footer.privacy || p.title === m.footer.terms;
}

/** The legal row every footer ends with: copyright, registration and the policy links. */
function LegalRow({ company, registration, m }: { company: string; registration?: string; m: ReturnType<typeof siteT> }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 text-[13px] text-white/50 sm:flex-row">
      <p className="text-center sm:text-start">
        © {YEAR} {company}. {m.footer.rights}.
        {registration && <span className="ms-2 whitespace-nowrap">· {m.footer.registration(registration)}</span>}
      </p>
      <div className="flex items-center gap-5">
        <FooterLink href={routes.privacy} label={m.footer.privacy} />
        <FooterLink href={routes.terms} label={m.footer.terms} />
      </div>
    </div>
  );
}

export function Footer({ locale, branding, pages = [] }: { locale: Locale; branding?: BrandingData; pages?: PublicPageLink[] }) {
  const m = siteT(locale);
  const company = companyName(branding, locale, SITE.name);

  // Branding fields first; phone and email fall back to the site's env; the
  // rest show only when the company filled them in.
  const phone = branding?.contactPhone ?? getContactPhone();
  const email = branding?.contactEmail ?? getContactEmail();
  const whatsapp = branding?.contactWhatsApp;
  const address = pickText(branding?.contactAddress, locale);
  const hours = pickText(branding?.officeHours, locale);
  const tagline = pickText(branding?.tagline, locale) || m.footer.taglineDefault;
  const socials = SOCIAL_ORDER.flatMap((k) => (branding?.socialLinks?.[k] ? [{ key: k, url: branding.socialLinks[k]! }] : []));
  const app = companyApp(branding?.mobileApp);
  const aboutPages = pages.filter((p) => !isLegalPage(p, m));

  const contactRows = [
    phone ? { icon: Phone, label: m.footer.phone, value: <span dir="ltr">{phone}</span>, href: telHref(phone) } : null,
    email ? { icon: Mail, label: m.footer.email, value: <span dir="ltr" className="break-all">{email}</span>, href: `mailto:${email}` } : null,
    address ? { icon: MapPin, label: m.footer.addressLabel, value: address } : null,
    hours ? { icon: Clock, label: m.footer.hours, value: hours } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  const slim = (
    <footer className="bg-navy">
      <Container className="py-6">
        <LegalRow company={company} registration={branding?.registrationNumber} m={m} />
      </Container>
    </footer>
  );

  const full = (
    <footer className="relative overflow-hidden bg-navy text-white/80">
      <span aria-hidden className="pointer-events-none absolute -end-32 -top-32 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl" />

      <Container className="relative">
        {/* The ask: talk to an advisor, on the company's deep colour. */}
        <div className="relative -mb-px flex flex-col gap-6 overflow-hidden rounded-b-[1.75rem] px-7 py-8 sm:px-10 lg:flex-row lg:items-center lg:justify-between" style={{ background: DEEP_BG }}>
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 120% at 100% 0%, rgb(var(--c-gold-400) / 0.18), transparent 60%)' }} />
          <div className="relative">
            <p className="font-display text-[1.6rem] font-semibold leading-tight text-white">{m.footer.ctaTitle}</p>
            <p className="mt-2 text-[15px] text-white/70">{m.footer.ctaSub}</p>
          </div>
          <div className="relative flex flex-wrap gap-2.5">
            <Link
              href={`${routes.contact}?type=visit` as Route}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206] transition-colors hover:bg-gold-300"
            >
              <CalendarDays className="h-[18px] w-[18px]" aria-hidden />
              {m.footer.ctaVisit}
            </Link>
            {whatsapp && (
              <a
                href={whatsappHref(whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                <WhatsAppIcon className="h-[18px] w-[18px] text-[#25D366]" />
                {m.footer.whatsapp}
              </a>
            )}
            {phone && (
              <a
                href={telHref(phone)}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Phone className="h-[18px] w-[18px]" aria-hidden />
                {m.footer.call}
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-10 py-14 lg:grid-cols-12">
          {/* The company */}
          <div className="col-span-2 lg:col-span-4">
            <div className="flex items-center gap-3">
              <CompanyMark branding={branding} name={company} size={40} className="h-10 w-10" />
              <span className="font-display text-xl font-semibold text-white">{company}</span>
            </div>
            <p className="mt-4 max-w-sm text-[15px] leading-[1.9] text-white/65">{tagline}</p>
            {socials.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-[13px] font-semibold text-white/50">{m.footer.follow}</p>
                <div className="flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.key}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/15 hover:text-white"
                    >
                      <SocialIcon name={s.key} className="h-[18px] w-[18px]" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {app && (app.appStore || app.googlePlay) && (
              <div className="mt-6">
                <p className="mb-3 text-[13px] font-semibold text-white/50">{m.footer.ourApp}</p>
                <div className="flex flex-wrap gap-2">
                  {app.appStore && (
                    <a href={app.appStore} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl bg-white/[0.07] px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 hover:bg-white/15">
                      App Store
                    </a>
                  )}
                  {app.googlePlay && (
                    <a href={app.googlePlay} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl bg-white/[0.07] px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 hover:bg-white/15">
                      Google Play
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* The site */}
          <nav aria-label={m.footer.siteNav} className="flex flex-col gap-3.5 lg:col-span-2">
            <ColumnHeading>{m.footer.siteNav}</ColumnHeading>
            {PRIMARY_NAV.map((item) => (
              <FooterLink key={item.href} href={item.href} label={locale === 'ar' ? item.label : item.labelEn} />
            ))}
          </nav>

          {/* The company's own published pages, minus the policies the legal row links. */}
          {aboutPages.length > 0 && (
            <nav aria-label={m.footer.pages} className="flex flex-col gap-3.5 lg:col-span-2">
              <ColumnHeading>{m.footer.pages}</ColumnHeading>
              {aboutPages.map((p) => (
                <FooterLink key={p.slug} href={routes.page(p.slug)} label={p.title} />
              ))}
            </nav>
          )}

          {/* How to reach it */}
          {contactRows.length > 0 && (
            <div className={aboutPages.length > 0 ? 'col-span-2 lg:col-span-4' : 'col-span-2 lg:col-span-6'}>
              <ColumnHeading>{m.footer.contactUs}</ColumnHeading>
              <ul className="space-y-4">
                {contactRows.map(({ icon: Icon, label, value, href }) => {
                  const body = (
                    <>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-gold-300 ring-1 ring-white/10">
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] text-white/50">{label}</span>
                        <span className="block text-[15px] text-white/90">{value}</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={label}>
                      {href ? (
                        <a href={href} className="flex items-center gap-3 transition-opacity hover:opacity-80">
                          {body}
                        </a>
                      ) : (
                        <div className="flex items-center gap-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 py-6">
          <LegalRow company={company} registration={branding?.registrationNumber} m={m} />
        </div>
      </Container>
    </footer>
  );

  return <FooterSwitch full={full} slim={slim} />;
}
