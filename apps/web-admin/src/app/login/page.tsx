import Image from 'next/image';
import { Building2, Calendar, Users, CreditCard } from 'lucide-react';
import LoginForm from './form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const sp = await searchParams;
  const from = typeof sp.from === 'string' ? sp.from : undefined;

  return (
    // h-screen + overflow-y-auto = inner scroll container
    // (body has `overflow: hidden` globally; this creates the real scroll surface)
    <div className="relative h-screen overflow-y-auto bg-canvas" dir="rtl">

      {/* ── Ambient page background ────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Warm navy bloom — upper-left corner */}
        <div className="absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-navy/[0.04] blur-[120px]" />
        {/* Gold bloom — lower-right */}
        <div className="absolute -bottom-48 right-[15%] h-[500px] w-[500px] rounded-full bg-brand-500/[0.07] blur-[110px]" />
        {/* Warm cream haze — center */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-50/60 blur-[130px]" />
      </div>

      {/* ── Centering wrapper ──────────────────────────────────────────── */}
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6 lg:py-10">

        {/* ════════════════════════════════════════════════════════════════
            AUTH SHELL — one composed luxury card floating on the page.
            RTL flex: first child → right column; second child → left column.
            ════════════════════════════════════════════════════════════════ */}
        <div className="w-full max-w-[1120px] overflow-hidden rounded-[2rem] border border-hairline shadow-[0_32px_100px_-24px_rgba(15,30,51,0.22),0_8px_32px_-8px_rgba(15,30,51,0.10),0_0_0_1px_rgba(231,223,211,0.55)]">
          <div className="flex flex-col lg:flex-row">

            {/* ── RIGHT: Login panel ─────────────────────────────────── */}
            <div className="relative flex w-full flex-col justify-center overflow-hidden bg-[#F6F1E9] px-8 py-12 lg:w-[440px] lg:shrink-0 lg:px-10 lg:py-14">

              {/* Warm gold bloom — upper-right corner of the panel */}
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/[0.07] blur-[70px]" />
              {/* Warm cream accent — lower area */}
              <div aria-hidden className="pointer-events-none absolute -bottom-10 left-4 h-52 w-52 rounded-full bg-brand-100/80 blur-[55px]" />
              {/* Left-edge gradient — softens the hard seam with the dark panel */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0d1b2a]/[0.05] to-transparent" />

              <div className="relative">
                {/* Brand chip */}
                <div className="mb-6 flex items-center gap-2.5">
                  <Image
                    src="/brand/devora-logo.png"
                    alt="ديفورا"
                    width={30}
                    height={30}
                    priority
                    className="h-[30px] w-[30px] rounded-lg object-cover ring-1 ring-hairline"
                  />
                  <span className="text-sm font-bold text-navy">ديفورا</span>
                </div>

                {/* Inner form card — matches dashboard Card component exactly */}
                <div className="rounded-2xl border border-hairline bg-surface px-7 py-7 shadow-soft">
                  {/* Heading */}
                  <div className="mb-7">
                    <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-navy">
                      تسجيل الدخول
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      أدخل بيانات حسابك للوصول إلى لوحة التحكم
                    </p>
                  </div>

                  {/* Form — all auth logic lives here, untouched */}
                  <LoginForm from={from} />
                </div>

                {/* Footer note */}
                <p className="mt-5 text-center text-xs text-text-muted">
                  © {new Date().getFullYear()} ديفورا — جميع الحقوق محفوظة
                </p>
              </div>
            </div>

            {/* ── LEFT: Brand / visual panel ─────────────────────────── */}
            <div className="relative hidden flex-1 overflow-hidden lg:flex lg:flex-col">

              {/* Dark navy base — matches sidebar-bg (#0F1E33) */}
              <div className="absolute inset-0 bg-gradient-to-br from-navy via-[#0c1929] to-navy" />

              {/* Ambient gold glow — upper right of panel */}
              <div aria-hidden className="absolute -right-24 -top-24 h-[440px] w-[440px] rounded-full bg-brand-500/[0.13] blur-[90px]" />
              {/* Ambient blue glow — lower center */}
              <div aria-hidden className="absolute bottom-0 left-[25%] h-[380px] w-[380px] rounded-full bg-brand-500/[0.06] blur-[80px]" />

              {/* Dot grid — very subtle depth texture */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                  backgroundSize: '26px 26px',
                }}
              />

              {/* Gold hairline at the top edge */}
              <div aria-hidden className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

              {/* ── Panel content ── */}
              <div className="relative z-10 flex h-full flex-col p-10">

                {/* Brand mark */}
                <div className="flex items-center gap-3">
                  <Image
                    src="/brand/devora-logo.png"
                    alt="ديفورا"
                    width={38}
                    height={38}
                    priority
                    className="h-[38px] w-[38px] rounded-xl object-cover ring-1 ring-white/10"
                  />
                  <div>
                    <p className="text-[15px] font-bold leading-none text-white">ديفورا</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-400">
                      Enterprise Platform
                    </p>
                  </div>
                </div>

                {/* ── Hero + feature value — vertically centered ── */}
                <div className="flex flex-1 flex-col justify-center gap-7">

                  {/* Hero text */}
                  <div>
                    <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-brand-400">
                      منصة إدارة عقارية
                    </p>
                    <h2 className="text-[2.15rem] font-extrabold leading-[1.22] tracking-tight text-white">
                      أدِر مشاريعك العقارية
                      <br />
                      <span className="text-brand-400">باحترافية كاملة</span>
                    </h2>
                    <p className="mt-3 text-[0.875rem] leading-relaxed text-slate-300/75">
                      منصة متكاملة لإدارة الوحدات والمشاريع والحجوزات والعملاء في مكان واحد.
                    </p>
                  </div>

                  {/* Feature value cards — 2 × 2 */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { Icon: Building2,  label: 'إدارة الوحدات'       },
                      { Icon: Calendar,   label: 'متابعة الحجوزات'      },
                      { Icon: Users,      label: 'لوحة عملاء متكاملة'  },
                      { Icon: CreditCard, label: 'تقارير ومدفوعات'      },
                    ].map(({ Icon, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3.5 py-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/[0.14] ring-1 ring-brand-400/[0.22]">
                          <Icon className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                        </span>
                        <span className="text-[12px] font-semibold leading-snug text-white/80">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Trust stats — inline, no big cards */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[11.5px] text-white/45">
                      <strong className="font-bold text-white/65">+500</strong>{' '}وحدة عقارية
                    </span>
                    <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-white/20" />
                    <span className="text-[11.5px] text-white/45">
                      <strong className="font-bold text-white/65">12</strong>{' '}مشروع نشط
                    </span>
                    <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-white/20" />
                    <span className="text-[11.5px] text-white/45">
                      <strong className="font-bold text-white/65">24/7</strong>{' '}دعم متواصل
                    </span>
                  </div>
                </div>

                {/* Panel footer */}
                <div className="mt-8 border-t border-white/[0.08] pt-4">
                  <p className="text-[11px] text-slate-600">
                    © {new Date().getFullYear()} ديفورا — منصة الإدارة العقارية
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
