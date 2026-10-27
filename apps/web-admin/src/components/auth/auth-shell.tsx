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
  const pillars = [
    { en: 'CRM', ar: 'العملاء والمبيعات' },
    { en: 'Inventory', ar: 'المشاريع والوحدات' },
    { en: 'Collections', ar: 'العقود والتحصيل' },
  ];
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/[0.06] lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,#16213A_0%,#0A1020_45%,#05080E_100%)]" />
      <div aria-hidden className="absolute -left-32 bottom-[-20%] h-[620px] w-[620px] rounded-full bg-[#C8A24B]/[0.10] blur-[140px]" />
      {/* Fine architectural grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at 40% 40%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 40% 40%, black 30%, transparent 75%)',
        }}
      />
      <Skyline />

      <div className="relative z-10 flex h-full flex-col justify-between p-14 xl:p-20">
        <p dir="ltr" className="self-end text-[11px] font-semibold tracking-[0.32em] text-[#C8A24B]/90">
          PROPERTY · SALES · FINANCE
        </p>

        <div className="max-w-[560px]">
          <h2 className="font-heading text-[2.6rem] font-bold leading-[1.3] text-[#F7F2E8] xl:text-[3.1rem]">
            مشاريعك ووحداتك وتحصيلاتك
            <span className="block bg-gradient-to-l from-[#E9D49B] via-[#C8A24B] to-[#AE8835] bg-clip-text text-transparent">
              في منصة واحدة.
            </span>
          </h2>
          <p className="mt-5 max-w-[460px] text-[15px] leading-loose text-[#9AA4B6]">
            من أول اتصال بالعميل حتى آخر قسط — منصة تشغيل متكاملة للمطورين العقاريين وشركات الوساطة.
          </p>

          <dl className="mt-12 grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.08] border-y border-white/[0.08]">
            {pillars.map((p) => (
              <div key={p.en} className="px-5 py-5 first:pr-0">
                <dt dir="ltr" className="text-right font-numeric text-[22px] font-semibold text-[#F4EFE6]">
                  {p.en}
                </dt>
                <dd className="mt-1 text-[12px] text-[#8C96A8]">{p.ar}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-[12px] text-[#5A6478]">مصممة للشركات متعددة الفروع — بأمان على مستوى المؤسسات.</p>
      </div>
    </aside>
  );
}

/** Line drawing of towers along the bottom of the brand panel. */
function Skyline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 360"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-[30%] w-full"
      fill="none"
      stroke="#C8A24B"
      strokeWidth="1"
    >
      <defs>
        <linearGradient id="auth-skyline-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C8A24B" stopOpacity="0.28" />
          <stop offset="1" stopColor="#C8A24B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="url(#auth-skyline-fade)">
        <path d="M40 360V210h70v150M110 360V150h60v210M170 360V240h50v120" />
        <path d="M250 360V90l45-30 45 30v270M295 60V20" />
        <path d="M370 360V170h80v190M450 360V120h55v240M505 360V200h40v160" />
        <path d="M580 360V60h70v300M615 60V30M650 360V180h60v180M710 360V230h50v130" />
        {/* floor lines */}
        {[110, 140, 170, 200, 230, 260, 290, 320].map((y) => (
          <path key={y} d={`M250 ${y}h90M580 ${y}h70`} strokeOpacity="0.5" />
        ))}
      </g>
      <path d="M0 359.5h800" stroke="#C8A24B" strokeOpacity="0.25" />
    </svg>
  );
}
