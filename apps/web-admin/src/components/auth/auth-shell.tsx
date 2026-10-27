import Image from 'next/image';
import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * The frame of every page before sign-in (login, platform login, forgot and
 * reset password): the form on one side, the brand on the other.
 *
 * It keeps one dark look whatever the dashboard theme is — the pages are
 * reached signed out, often with `.dark` left on <html> from a past session,
 * and the theme tokens (canvas, surface, navy text) flip under it. So the
 * colours here are fixed values, not theme tokens.
 */
export function AuthShell({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  /** A small line above the title (e.g. who the page is for). */
  eyebrow?: string;
  children: ReactNode;
}) {
  const year = new Date().getFullYear();
  return (
    <div className="relative h-screen overflow-y-auto bg-[#05080E] text-[#F4EFE6] [color-scheme:dark]" dir="rtl">
      <div className="grid min-h-full lg:grid-cols-[minmax(460px,5fr)_7fr]">
        {/* ── Form side ─────────────────────────────────────────────── */}
        <main className="relative flex flex-col overflow-hidden px-6 py-8 sm:px-12 lg:px-16">
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#C8A24B]/[0.08] blur-[120px]" />

          <header className="relative flex items-center gap-3">
            <Image
              src="/brand/devora-logo.png"
              alt=""
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-[10px] object-cover ring-1 ring-white/10"
            />
            <div className="leading-none">
              <p dir="ltr" className="font-numeric text-[19px] font-semibold uppercase tracking-[0.34em] text-[#F4EFE6]">
                Devora
              </p>
              <p className="mt-1 text-[11px] text-[#8C96A8]">ديفورا</p>
            </div>
          </header>

          <div className="relative flex flex-1 items-center py-12">
            <div className="mx-auto w-full max-w-[400px]">
              {eyebrow && (
                <p className="mb-4 flex items-center gap-3 text-[11px] font-semibold tracking-[0.18em] text-[#C8A24B]">
                  <span aria-hidden className="h-px w-8 bg-[#C8A24B]/60" />
                  {eyebrow}
                </p>
              )}
              <h1 className="font-heading text-[2rem] font-bold leading-[1.25] text-[#F7F2E8] sm:text-[2.25rem]">
                {title}
              </h1>
              {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-[#8C96A8]">{subtitle}</p>}

              <div className="mt-10">{children}</div>

              <p className="mt-10 flex items-center gap-2 text-[12px] text-[#6B7588]">
                <ShieldCheck className="h-4 w-4 text-[#C8A24B]/80" aria-hidden />
                اتصال مشفّر — بياناتك محمية ومعزولة لكل شركة
              </p>
            </div>
          </div>

          <footer className="relative flex items-center justify-between text-[11px] text-[#5A6478]">
            <span>© {year} Devora</span>
            <span dir="ltr" className="tracking-[0.2em]">REAL ESTATE OS</span>
          </footer>
        </main>

        {/* ── Brand side ────────────────────────────────────────────── */}
        <BrandPanel />
      </div>
    </div>
  );
}

/** The photo on the brand side; until the file is there, the dark gradient alone shows. */
const HERO_IMAGE = '/brand/login-hero.jpg';

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden lg:block">
      <div
        className="absolute inset-0 scale-[1.02] bg-[#0A1020] bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      />
      {/* Darken towards the text and the form side; a warm gold wash on top. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05080E] via-[#05080E]/45 to-[#05080E]/10" />
      <div className="absolute inset-0 bg-gradient-to-l from-[#05080E]/80 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[#C8A24B]/[0.06] mix-blend-overlay" />

      <div className="relative z-10 flex h-full flex-col justify-end p-14 xl:p-20">
        <div className="max-w-[560px]">
          <p className="mb-5 flex items-center gap-3 text-[12px] font-semibold tracking-[0.18em] text-[#C8A24B]">
            <span aria-hidden className="h-px w-10 bg-[#C8A24B]/70" />
            منصة إدارة العقارات
          </p>
          <h2 className="font-heading text-[2.4rem] font-bold leading-[1.3] text-[#F7F2E8] xl:text-[2.9rem]">
            نبني معك <span className="text-[#C8A24B]">إدارة تليق بمشاريعك.</span>
          </h2>
          <p className="mt-4 max-w-[480px] text-[15px] leading-loose text-[#B4BCCB]">
            المبيعات والحجوزات والعقود والتحصيل في منصة واحدة — لكل فريقك.
          </p>
        </div>
      </div>
    </aside>
  );
}
