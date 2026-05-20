import LoginForm from './form';

export default async function LoginPage({
  searchParams,
}: {
  // Next.js 15 makes route params async.
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const sp = await searchParams;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  return (
    <div className="min-h-screen flex flex-col lg:flex-row" dir="rtl">

      {/* ── Hero panel (right in RTL = visually left) ── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-[#0f1e2e]">

        {/* Layered gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1e2e] via-[#1a2e44] to-[#0c1a28]" />
        {/* Subtle gold radial glow */}
        <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-brand-600/10 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-brand-500/8 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4" />

        {/* Brand name */}
        <div className="relative z-10">
          <span className="text-xl font-bold text-white tracking-tight">
            إدارة العقارات
          </span>
        </div>

        {/* Main hero text */}
        <div className="relative z-10 space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">
            Enterprise Platform
          </p>
          <h1 className="text-[2.75rem] font-extrabold leading-[1.15] text-white">
            أدِر مشاريعك العقارية
            <br />
            <span className="text-brand-400">باحترافية كاملة</span>
          </h1>
          <p className="text-base text-slate-300 max-w-sm leading-relaxed">
            منصة متكاملة لإدارة الوحدات والمشاريع والحجوزات والعملاء في مكان واحد.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative z-10 flex items-end gap-10 pt-6 border-t border-white/10">
          {[
            { value: '+500', label: 'وحدة عقارية' },
            { value: '12', label: 'مشروع نشط' },
            { value: '24/7', label: 'دعم متواصل' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile-only brand */}
        <p className="lg:hidden text-lg font-bold text-slate-900 mb-8">إدارة العقارات</p>

        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-[1.9rem] font-extrabold text-slate-900 leading-tight mb-2">
              تسجيل الدخول
            </h2>
            <p className="text-sm text-slate-500">
              أدخل بيانات حسابك للوصول إلى لوحة التحكم.
            </p>
          </div>

          <LoginForm from={from} />
        </div>
      </div>

    </div>
  );
}
