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

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex lg:flex-col lg:justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_30%_40%,#131D33_0%,#090E1A_55%,#05080E_100%)]" />
      <div aria-hidden className="absolute left-[35%] top-[40%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C8A24B]/[0.09] blur-[140px]" />

      <div className="relative z-10 mx-auto w-full max-w-[640px] px-12 xl:px-16">
        <DashboardPreview />

        <div className="mt-14">
          <h2 className="font-heading text-[2.1rem] font-bold leading-[1.35] text-[#F7F2E8] xl:text-[2.4rem]">
            لوحة تحكم واحدة <span className="text-[#C8A24B]">لكل أعمالك العقارية</span>
          </h2>
          <p className="mt-3 max-w-[480px] text-[15px] leading-loose text-[#8C96A8]">
            المبيعات والحجوزات والعقود والتحصيل — لحظة بلحظة، لكل فريقك.
          </p>
        </div>
      </div>
    </aside>
  );
}

/*
 * A stylised dashboard: shapes, not data. The page is seen before sign-in,
 * so it shows no figures (no made-up numbers — see e2e ui-details F6).
 */
function DashboardPreview() {
  const glass = 'rounded-2xl border border-white/[0.08] bg-[#0E1526]/80 backdrop-blur-xl';
  const bar = (w: string, tone = 'bg-white/[0.09]') => <span className={`block h-2 rounded-full ${tone}`} style={{ width: w }} />;
  return (
    <div aria-hidden className="relative">
      {/* Main window */}
      <div className={`${glass} overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)]`}>
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          <span className="mr-auto h-2 w-24 rounded-full bg-white/[0.06]" />
        </div>
        <div className="flex">
          {/* Sidebar */}
          <div className="w-14 shrink-0 space-y-3 border-l border-white/[0.06] p-3">
            <span className="block h-8 w-8 rounded-lg bg-[#C8A24B]/25 ring-1 ring-[#C8A24B]/40" />
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="block h-8 w-8 rounded-lg bg-white/[0.04]" />
            ))}
          </div>
          <div className="flex-1 space-y-4 p-5">
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3">
              {['المبيعات', 'الحجوزات', 'التحصيل'].map((label, i) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-[11px] text-[#8C96A8]">{label}</p>
                  <div className="mt-2.5 space-y-1.5">
                    {bar(i === 2 ? '70%' : '60%', 'bg-[#F4EFE6]/[0.22]')}
                    {bar('40%')}
                  </div>
                  <svg viewBox="0 0 80 20" className="mt-3 h-5 w-full" fill="none">
                    <path
                      d={['M0 16 L16 12 L32 14 L48 7 L64 9 L80 3', 'M0 14 L16 15 L32 9 L48 11 L64 5 L80 6', 'M0 17 L16 13 L32 11 L48 8 L64 6 L80 2'][i]}
                      stroke="#C8A24B"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              ))}
            </div>
            {/* Chart */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] text-[#8C96A8]">التحصيل الشهري</p>
                <span className="h-2 w-14 rounded-full bg-white/[0.07]" />
              </div>
              <svg viewBox="0 0 300 90" className="h-[90px] w-full" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="auth-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#C8A24B" stopOpacity="0.35" />
                    <stop offset="1" stopColor="#C8A24B" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[22, 45, 68].map((y) => (
                  <path key={y} d={`M0 ${y}H300`} stroke="#ffffff" strokeOpacity="0.05" />
                ))}
                <path d="M0 70 C30 64 45 50 75 54 S120 30 150 36 S200 20 225 24 S270 8 300 12 V90 H0Z" fill="url(#auth-area)" />
                <path d="M0 70 C30 64 45 50 75 54 S120 30 150 36 S200 20 225 24 S270 8 300 12" stroke="#D9BC72" strokeWidth="2" />
              </svg>
            </div>
            {/* Rows */}
            <div className="space-y-2.5">
              {['78%', '62%'].map((w) => (
                <div key={w} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5">
                  <span className="h-6 w-6 shrink-0 rounded-full bg-white/[0.07]" />
                  <div className="flex-1">{bar(w)}</div>
                  <span className="h-4 w-12 rounded-full bg-[#86C9A0]/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating: collection ring */}
      <div className={`${glass} absolute -bottom-8 -left-8 flex items-center gap-3 px-4 py-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)]`}>
        <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
          <circle cx="18" cy="18" r="15" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="4" fill="none" />
          <circle cx="18" cy="18" r="15" stroke="#C8A24B" strokeWidth="4" fill="none" strokeDasharray="70 100" strokeLinecap="round" />
        </svg>
        <div>
          <p className="text-[12px] font-semibold text-[#F4EFE6]">نسبة التحصيل</p>
          <p className="mt-0.5 text-[11px] text-[#8C96A8]">تتحدّث لحظيًا</p>
        </div>
      </div>

      {/* Floating: notification */}
      <div className={`${glass} absolute -right-6 -top-6 flex items-center gap-3 px-4 py-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)]`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#86C9A0]/15">
          <span className="h-2.5 w-2.5 rounded-full bg-[#86C9A0]" />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-[#F4EFE6]">تم توقيع عقد جديد</p>
          <p className="mt-0.5 text-[11px] text-[#8C96A8]">قسم المبيعات</p>
        </div>
      </div>
    </div>
  );
}
