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

          {/* The brand panel carries the mark on wide screens. */}
          <header className="relative flex items-center gap-3 lg:invisible">
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
            <span dir="ltr" className="tracking-[0.2em] lg:hidden">REAL ESTATE OS</span>
          </footer>
        </main>

        {/* ── Brand side ────────────────────────────────────────────── */}
        <BrandPanel />
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_45%,#121B30_0%,#080C16_55%,#05080E_100%)]" />
      {/* Gold light behind the mark */}
      <div aria-hidden className="absolute left-1/2 top-[42%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C8A24B]/[0.14] blur-[130px]" />
      {/* Concentric hairline rings */}
      {[260, 400, 560, 740].map((d, i) => (
        <div
          key={d}
          aria-hidden
          className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C8A24B]"
          style={{ width: d, height: d, opacity: 0.16 - i * 0.035 }}
        />
      ))}

      <div className="relative z-10 flex -translate-y-[4%] flex-col items-center text-center">
        <div className="rounded-[28px] bg-gradient-to-b from-[#E9D49B]/50 via-[#C8A24B]/20 to-transparent p-px shadow-[0_30px_80px_-20px_rgba(200,162,75,0.45)]">
          <Image
            src="/brand/devora-logo.png"
            alt="Devora"
            width={132}
            height={132}
            priority
            className="h-[132px] w-[132px] rounded-[27px] object-cover"
          />
        </div>

        <p dir="ltr" className="mt-12 pl-[0.5em] font-numeric text-[56px] font-medium uppercase leading-none tracking-[0.5em] text-[#F4EFE6] xl:text-[64px]">
          Devora
        </p>

        <div className="mt-8 flex items-center gap-5">
          <span aria-hidden className="h-px w-16 bg-gradient-to-l from-[#C8A24B]/70 to-transparent" />
          <span className="text-[15px] font-semibold tracking-wide text-[#C8A24B]">منصة إدارة العقارات</span>
          <span aria-hidden className="h-px w-16 bg-gradient-to-r from-[#C8A24B]/70 to-transparent" />
        </div>
        <p dir="ltr" className="mt-4 text-[11px] tracking-[0.42em] text-[#6B7588]">REAL ESTATE OPERATING SYSTEM</p>
      </div>
    </aside>
  );
}
