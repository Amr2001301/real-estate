import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import { getContactPhone, getContactEmail } from '@/lib/contact';
import type { BrandingData } from '@/lib/branding';
import { Container } from '@/components/ui/Container';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const PLATFORM_LOGO = '/brand/platform-logo.svg';
const YEAR = new Date().getFullYear();

type ContactRow = { icon: typeof Phone; text: string; dir: 'ltr' | 'rtl' };

const DOTS = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
} as const;

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as Route}
      className="inline-flex w-fit items-center text-sm text-white/65 transition-colors hover:text-gold-200"
    >
      {label}
    </Link>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return <span className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-gold-200">{children}</span>;
}

export function Footer({ locale, branding }: { locale: Locale; branding?: BrandingData }) {
  const m = siteT(locale);

  const companyName = branding?.displayName ?? branding?.name ?? SITE.name;
  const logoSrc     = branding?.logoUrl ?? PLATFORM_LOGO;

  // Contact rows: branding fields take priority over env vars.
  // WhatsApp only renders when branding supplies it (no env fallback).
  // Address only renders when branding supplies it (per-tenant data, no platform placeholder).
  const contactPhone   = branding?.contactPhone   ?? getContactPhone();
  const contactEmail   = branding?.contactEmail   ?? getContactEmail();
  const contactWA      = branding?.contactWhatsApp;
  const contactAddress = branding?.contactAddress?.[locale];

  const contact: ContactRow[] = [
    ...(contactPhone   ? [{ icon: Phone,         text: contactPhone,   dir: 'ltr' as const }] : []),
    ...(contactEmail   ? [{ icon: Mail,           text: contactEmail,   dir: 'ltr' as const }] : []),
    ...(contactWA      ? [{ icon: MessageCircle,  text: contactWA,      dir: 'ltr' as const }] : []),
    ...(contactAddress ? [{ icon: MapPin,         text: contactAddress, dir: locale === 'ar' ? 'rtl' as const : 'ltr' as const }] : []),
  ];

  const accountLinks = [
    { label: m.footer.login,     href: routes.login },
    { label: m.footer.register,  href: routes.register },
    { label: m.footer.contactUs, href: routes.contact },
  ];

  return (
    <footer className="relative overflow-hidden bg-navy text-white/80">
      {/* Brand-accent separator: marks the opening of the footer with tenant colour. */}
      <div className="h-px w-full bg-gradient-to-l from-transparent via-brand-accent/50 to-transparent" aria-hidden />
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={DOTS} />
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />

      <Container className="relative py-12 lg:py-16">
        <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <Image
                src={logoSrc}
                alt={companyName}
                width={32}
                height={32}
                className="h-8 w-8 rounded-md object-cover"
              />
              <span className="font-display text-xl text-white">{companyName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              {m.footer.tagline}
            </p>
          </div>

          {/* Explore */}
          <nav className="flex flex-col gap-3 lg:col-span-2">
            <ColumnHeading>{m.footer.explore}</ColumnHeading>
            {PRIMARY_NAV.map((item) => (
              <FooterLink
                key={item.href}
                href={item.href}
                label={locale === 'ar' ? item.label : item.labelEn}
              />
            ))}
          </nav>

          {/* Account */}
          <nav className="flex flex-col gap-3 lg:col-span-2">
            <ColumnHeading>{m.footer.account}</ColumnHeading>
            {accountLinks.map((item) => (
              <FooterLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          {/* Contact */}
          <div className="flex flex-col gap-3 lg:col-span-3">
            <ColumnHeading>{m.footer.contactUs}</ColumnHeading>
            {contact.map(({ icon: Icon, text, dir }) => (
              <div key={text} className="flex items-center gap-2.5 text-sm text-white/65">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gold-200 ring-1 ring-white/10">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span dir={dir}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legal row */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row">
          <p>
            © {YEAR} {companyName}. {m.footer.rights}.
          </p>
          <div className="flex items-center gap-5">
            <FooterLink href={routes.privacy} label={m.footer.privacy} />
            <FooterLink href={routes.terms}   label={m.footer.terms}   />
          </div>
        </div>
      </Container>
    </footer>
  );
}
