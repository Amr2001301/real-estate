import Link from 'next/link';
import type { Route } from 'next';
import { Phone, Mail, MapPin } from 'lucide-react';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import { Container } from '@/components/ui/Container';

const YEAR = new Date().getFullYear();

const ACCOUNT_LINKS: Array<{ label: string; href: string }> = [
  { label: 'تسجيل الدخول', href: routes.login },
  { label: 'إنشاء حساب', href: routes.register },
  { label: 'تواصل معنا', href: routes.contact },
];

const CONTACT = [
  { icon: Phone, text: '+966 11 000 0000', dir: 'ltr' as const },
  { icon: Mail, text: 'hello@dar-alfakhama.sa', dir: 'ltr' as const },
  { icon: MapPin, text: 'الرياض، المملكة العربية السعودية', dir: 'rtl' as const },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as Route} className="text-sm text-white/65 transition-colors hover:text-gold-200">
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="relative bg-navy text-white/80">
      <div className="h-px w-full bg-gradient-to-l from-transparent via-gold-400/50 to-transparent" aria-hidden />

      <Container className="py-8 lg:py-10">
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold-400" aria-hidden />
              <span className="font-display text-xl text-white">{SITE.name}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              نختار لك مشاريع ووحدات سكنية بعناية لتجربة عقارية راقية وموثوقة.
            </p>
          </div>

          {/* Explore */}
          <nav className="flex flex-col gap-2.5 lg:col-span-2">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-200">استكشف</span>
            {PRIMARY_NAV.map((item) => (
              <FooterLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          {/* Account */}
          <nav className="flex flex-col gap-2.5 lg:col-span-2">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-200">الحساب</span>
            {ACCOUNT_LINKS.map((item) => (
              <FooterLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          {/* Contact mini block */}
          <div className="flex flex-col gap-2.5 lg:col-span-3">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-200">تواصل معنا</span>
            {CONTACT.map(({ icon: Icon, text, dir }) => (
              <div key={text} className="flex items-center gap-2.5 text-sm text-white/65">
                <Icon className="h-4 w-4 shrink-0 text-gold-200" aria-hidden />
                <span dir={dir}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slim legal row */}
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/45 sm:flex-row">
          <p>© {YEAR} {SITE.name}. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-5">
            <FooterLink href={routes.privacy} label="سياسة الخصوصية" />
            <FooterLink href={routes.terms} label="الشروط والأحكام" />
          </div>
        </div>
      </Container>
    </footer>
  );
}
