import { routes } from '@/lib/routes';
import { siteUrl } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/motion/Reveal';
import { QrCode } from './QrCode';

export function MobileAppPromo() {
  const appUrl = siteUrl(routes.app);

  return (
    <section className="relative pb-8 pt-32 lg:pt-36">
      <Container>
        <div
          dir="rtl"
          className="relative overflow-visible rounded-[28px] border border-[#e8ddc8] bg-[#fffaf2] shadow-[0_10px_52px_-18px_rgba(15,30,51,0.16)]"
        >
          {/* Warm abstract background */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]"
          >
            <span className="absolute -left-28 bottom-[-110px] h-[300px] w-[520px] rounded-full bg-[#f3e7d2]/45 blur-sm" />
            <span className="absolute left-[7%] top-1/2 h-[260px] w-[300px] -translate-y-1/2 rounded-full bg-gold-200/30 blur-3xl" />
            <span className="absolute left-[31%] top-[42%] h-[170px] w-[170px] rounded-full bg-gold-100/30 blur-2xl" />
            <span className="absolute right-[14%] top-[22%] h-20 w-20 rounded-full bg-gold-100/20 blur-2xl" />
          </div>

          {/* Desktop layout */}
          <div className="hidden min-h-[315px] lg:flex lg:items-stretch">
            {/* Text content - right side */}
            <div className="relative z-30 flex w-[46%] flex-col items-end justify-center py-10 pl-8 pr-12 text-right xl:pr-14">
              <Reveal>
                <span className="inline-flex rounded-full bg-gold-100/80 px-4 py-1.5 text-[13px] font-semibold text-[#9a7a35]">
                  تطبيق ديفورا العقاري
                </span>

                <h2 className="mt-4 text-[1.95rem] font-bold leading-[1.25] text-ink-strong xl:text-[2.18rem]">
                  حمّل تطبيق ديفورا
                  <br />
                  <span className="relative inline-block whitespace-nowrap">
                    واكتشف منزلك القادم بسهولة
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-1 h-[8px] rounded-full bg-gold-300/70"
                    />
                  </span>
                </h2>

                <p className="mt-5 max-w-[470px] text-[15px] leading-[1.9] text-ink-muted">
                  تصفّح المشاريع والوحدات، قارن الخيارات، واحجز زيارتك مباشرة من التطبيق
                  — كل ما تحتاجه في مكان واحد.
                </p>
              </Reveal>
            </div>

            {/* Phone hero - center */}
            <div className="relative z-20 w-[34%] overflow-visible">
              <img
                src="/mobile-transparent.png"
                alt="واجهة تطبيق ديفورا العقاري على الهاتف"
                className="absolute bottom-[-8px] left-1/2 h-[465px] w-auto -translate-x-1/2 object-contain drop-shadow-[0_28px_62px_rgba(15,30,51,0.24)] xl:h-[490px]"
                style={{ background: 'transparent' }}
              />
            </div>

            {/* QR card - left side */}
            <div className="relative z-20 flex w-[20%] items-center justify-center py-8">
              <div className="translate-x-6 rounded-[22px] border border-[#e8ddc8] bg-white/92 p-4 text-center shadow-[0_16px_34px_-18px_rgba(15,30,51,0.35)] backdrop-blur-sm xl:translate-x-8">
                <div className="flex items-center justify-center rounded-[18px] bg-[#fffaf2] p-1.5 ring-1 ring-[#e8ddc8]">
                  <QrCode
                    value={appUrl}
                    size={116}
                    className="h-[116px] w-[116px]"
                  />
                </div>

                <p className="mt-3 max-w-[120px] text-[13px] font-semibold leading-snug text-ink-muted">
                  امسح الرمز لتحميل التطبيق
                </p>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center lg:hidden">
            <Reveal>
              <span className="inline-flex rounded-full bg-gold-100/80 px-4 py-1.5 text-[12px] font-semibold text-[#9a7a35]">
                تطبيق ديفورا العقاري
              </span>

              <h2 className="mt-4 text-[1.65rem] font-bold leading-[1.3] text-ink-strong sm:text-[1.9rem]">
                حمّل تطبيق ديفورا
                <br />
                <span className="relative inline-block">
                  واكتشف منزلك القادم بسهولة
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[6px] rounded-full bg-gold-300/70"
                  />
                </span>
              </h2>

              <p className="mx-auto mt-4 max-w-[430px] text-[13px] leading-[1.9] text-ink-muted sm:text-[14px]">
                تصفّح المشاريع والوحدات، قارن الخيارات، واحجز زيارتك مباشرة من التطبيق
                — كل ما تحتاجه في مكان واحد.
              </p>
            </Reveal>

            <div className="relative mt-6 flex w-full justify-center">
              <span
                aria-hidden
                className="absolute bottom-2 left-1/2 h-36 w-56 -translate-x-1/2 rounded-full bg-gold-100/40 blur-2xl"
              />

              <img
                src="/mobile-transparent.png"
                alt="واجهة تطبيق ديفورا العقاري على الهاتف"
                className="relative z-10 w-[230px] object-contain drop-shadow-[0_20px_45px_rgba(15,30,51,0.22)] sm:w-[260px]"
                style={{ background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}