'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { Menu, X, UserCircle2, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import type { Locale } from '@/lib/locale';
import type { BrandingData } from '@/lib/branding';
import { siteT } from '@/messages/site';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LangToggle } from '@/components/theme/LangToggle';
import { logoutAction } from '@/lib/auth-actions';
import { readClientUser, type ClientUser } from '@/lib/client-user';

const PLATFORM_LOGO = '/brand/platform-logo.svg';

function Wordmark({ invert, branding }: { invert: boolean; branding?: BrandingData }) {
  const logo = branding?.logoUrl ?? PLATFORM_LOGO;
  const name = branding?.displayName ?? branding?.name ?? SITE.name;
  return (
    <Link
      href={routes.home}
      className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-0"
    >
      <Image
        src={logo}
        alt={name}
        width={28}
        height={28}
        priority
        className="h-7 w-7 rounded-md object-cover"
      />
      <span className={cn('font-display text-xl tracking-tight', invert ? 'text-white' : 'text-ink-strong')}>
        {name}
      </span>
    </Link>
  );
}

export function Navbar({ locale, branding }: { locale: Locale; branding?: BrandingData }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<ClientUser | null>(null);
  const m = siteT(locale);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setUser(readClientUser());
  }, [pathname]);

  const isHome = pathname === '/';
  const solid = !isHome || scrolled || open;

  const accountLabel = user?.fullName?.trim().split(/\s+/)[0] || m.nav.myAccount;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ease-smooth',
        solid ? 'border-hairline bg-canvas/90 shadow-soft backdrop-blur-md' : 'border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-20 items-center justify-between py-4">
        <Wordmark invert={!solid} branding={branding} />

        <nav className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                  solid ? 'text-ink-muted hover:bg-navy/[0.05] hover:text-ink-strong' : 'text-white/80 hover:bg-white/10 hover:text-white',
                  active && (solid ? 'text-ink-strong' : 'text-white'),
                )}
              >
                {locale === 'ar' ? item.label : item.labelEn}
                {active && (
                  // Brand-accent underline: this is the per-page identity marker —
                  // it carries tenant meaning, not structural chrome.
                  <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-brand-accent" aria-hidden />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LangToggle
            current={locale}
            className={cn(!solid && 'text-white/80 hover:bg-white/10 hover:text-white')}
          />
          <ThemeToggle
            className={cn(
              'rounded-lg',
              solid ? 'text-ink-muted hover:bg-surface-soft' : 'text-white/80 hover:bg-white/10 hover:text-white',
            )}
          />
          {user ? (
            <>
              <Link
                href={routes.account}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1 pe-2 ps-3 transition-all duration-200',
                  solid
                    ? 'border-hairline/60 bg-surface-soft hover:bg-hairline/40'
                    : 'border-white/15 bg-white/10 hover:bg-white/15',
                )}
              >
                <span className={cn('text-xs font-bold', solid ? 'text-ink-strong' : 'text-white')}>
                  {accountLabel}
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-[10px] font-black text-gold-600">
                  {(user.fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') || '؟').toUpperCase()}
                </span>
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label={m.nav.logout}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-200',
                    solid
                      ? 'border-error/20 bg-error/10 text-error hover:bg-error/15'
                      : 'border-white/15 bg-white/10 text-white/90 hover:bg-error/30 hover:text-white',
                  )}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {m.nav.logout}
                </button>
              </form>
            </>
          ) : (
            <ButtonLink href={routes.login} variant={solid ? 'outline' : 'gold'} size="sm">
              {m.nav.login}
            </ButtonLink>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <LangToggle
            current={locale}
            className={cn(!solid && 'text-white/80 hover:bg-white/10 hover:text-white')}
          />
          <ThemeToggle className={cn(!solid && 'text-white/80 hover:bg-white/10 hover:text-white')} />
          <button
            type="button"
            aria-label={open ? m.nav.closeMenu : m.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
              solid ? 'text-ink-strong hover:bg-navy/5' : 'text-white hover:bg-white/10',
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </Container>

      {open && <MobileMenu user={user} locale={locale} />}
    </header>
  );
}

function MobileMenu({ user, locale }: { user: ClientUser | null; locale: Locale }) {
  const m = siteT(locale);
  const accountLabel = user?.fullName?.trim().split(/\s+/)[0] || m.nav.myAccount;

  return (
    <div className="lg:hidden">
      <Container className="pb-6 pt-2">
        <nav className="flex flex-col gap-1 rounded-3xl border border-hairline bg-surface p-3 shadow-card">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              className="rounded-2xl px-4 py-3 text-base font-medium text-ink-strong transition-colors hover:bg-surface-soft"
            >
              {locale === 'ar' ? item.label : item.labelEn}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href={routes.account}
                className="mt-1 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-ink-strong transition-colors hover:bg-surface-soft"
              >
                <UserCircle2 className="h-5 w-5" aria-hidden />
                {accountLabel}
              </Link>
              <form action={logoutAction} className="mt-1">
                <button
                  type="submit"
                  className="inline-flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-ink-muted transition-colors hover:bg-surface-soft"
                >
                  <LogOut className="h-5 w-5" aria-hidden />
                  {m.nav.logout}
                </button>
              </form>
            </>
          ) : (
            <ButtonLink href={routes.login} variant="primary" size="md" className="mt-2 w-full">
              {m.nav.login}
            </ButtonLink>
          )}
        </nav>
      </Container>
    </div>
  );
}
