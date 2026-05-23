import Link from 'next/link';
import type { Route } from 'next';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Divider } from '@/components/ui/Divider';

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-navy text-white/80">
      <Container className="py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold-400" aria-hidden />
              <span className="font-display text-xl text-white">{SITE.name}</span>
            </div>
            <p className="mt-4 leading-relaxed text-white/65">{SITE.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
            <nav className="flex flex-col gap-3">
              <span className="mb-1 text-sm font-medium text-gold-200">استكشف</span>
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <nav className="flex flex-col gap-3">
              <span className="mb-1 text-sm font-medium text-gold-200">الحساب</span>
              <Link href={routes.login as Route} className="text-sm text-white/70 transition-colors hover:text-white">
                تسجيل الدخول
              </Link>
              <Link href={routes.register as Route} className="text-sm text-white/70 transition-colors hover:text-white">
                إنشاء حساب
              </Link>
              <Link href={routes.contact as Route} className="text-sm text-white/70 transition-colors hover:text-white">
                تواصل معنا
              </Link>
            </nav>
          </div>
        </div>

        <Divider className="my-10 border-white/10" />

        <div className="flex flex-col items-center justify-between gap-3 text-sm text-white/50 sm:flex-row">
          <p>
            © {YEAR} {SITE.name}. جميع الحقوق محفوظة.
          </p>
          <p className="text-white/40">صُمم بعناية لتجربة عقارية أرقى.</p>
        </div>
      </Container>
    </footer>
  );
}
