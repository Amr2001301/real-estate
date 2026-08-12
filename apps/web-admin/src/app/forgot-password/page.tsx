import Image from 'next/image';
import ForgotPasswordForm from './form';

export default function ForgotPasswordPage() {
  return (
    <div className="relative h-screen overflow-y-auto bg-canvas" dir="rtl">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-navy/[0.04] blur-[120px]" />
        <div className="absolute -bottom-48 right-[15%] h-[500px] w-[500px] rounded-full bg-brand-500/[0.07] blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-50/60 blur-[130px]" />
      </div>

      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6 lg:py-10">
        <div className="w-full max-w-[440px]">
          <div className="overflow-hidden rounded-[2rem] border border-hairline bg-[#F6F1E9] shadow-[0_32px_100px_-24px_rgba(15,30,51,0.22),0_8px_32px_-8px_rgba(15,30,51,0.10),0_0_0_1px_rgba(231,223,211,0.55)]">
            <div className="relative flex flex-col justify-center overflow-hidden px-8 py-12 lg:px-10 lg:py-14">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/[0.07] blur-[70px]" />
              <div aria-hidden className="pointer-events-none absolute -bottom-10 left-4 h-52 w-52 rounded-full bg-brand-100/80 blur-[55px]" />

              <div className="relative">
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

                <div className="rounded-2xl border border-hairline bg-surface px-7 py-7 shadow-soft">
                  <div className="mb-7">
                    <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-navy">
                      نسيت كلمة المرور؟
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      أدخل بريدك الإلكتروني وسنرسل إليك رابط إعادة التعيين
                    </p>
                  </div>

                  <ForgotPasswordForm />
                </div>

                <p className="mt-5 text-center text-xs text-text-muted">
                  © {new Date().getFullYear()} ديفورا — جميع الحقوق محفوظة
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
