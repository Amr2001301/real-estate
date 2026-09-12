import Image from 'next/image';
import SuperAdminLoginForm from './form';

export default function SuperAdminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-8" dir="rtl">

      {/* ── Ambient page background ──────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-navy/[0.04] blur-[120px]" />
        <div className="absolute -bottom-48 right-[15%] h-[500px] w-[500px] rounded-full bg-brand-500/[0.07] blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-50/60 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
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

        {/* Form card */}
        <div className="rounded-2xl border border-hairline bg-surface px-7 py-8 shadow-[0_8px_32px_-8px_rgba(15,30,51,0.14),0_0_0_1px_rgba(231,223,211,0.55)]">
          <div className="mb-7">
            <h1 className="text-[1.5rem] font-extrabold leading-tight tracking-tight text-navy">
              دخول المنصة
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              هذه الصفحة مخصصة لمديري المنصة فقط
            </p>
          </div>

          <SuperAdminLoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-text-muted">
          © {new Date().getFullYear()} ديفورا — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
