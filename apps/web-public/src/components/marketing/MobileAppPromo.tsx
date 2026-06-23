import { routes } from '@/lib/routes';
import { siteUrl } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/motion/Reveal';
import { QrCode } from './QrCode';

export function MobileAppPromo() {
  const appUrl = siteUrl(routes.app);

  return (
    <section className="relative pb-8 pt-32">
      <Container>
        <div className="relative overflow-visible rounded-[28px] border border-[#e8ddc8] bg-[#fffaf2] shadow-[0_8px_48px_-16px_rgba(15,30,51,0.12)]">

          {/* Warm gold glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
            <span className="absolute -left-10 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-gold-200/40 blur-3xl" />
            <span className="absolute left-1/3 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-gold-100/30 blur-2xl" />
          </div>

          {/* ── Desktop 3-column layout (RTL: text → right, phone → center, QR → left) ── */}
          <div className="hidden min-h-[320px] lg:flex lg:items-stretch">

            {/* Col 1 – Right (first in RTL flex): Text content 43% */}
            <div className="relative z-30 flex w-[43%] flex-col items-end justify-center py-10 pl-4 pr-10 text-right">
              <Reveal>
                <Badge tone="gold">تجربة رقمية متكاملة</Badge>

                <h2 className="mt-3 text-[1.85rem] font-bold leading-[1.3] text-ink-strong xl:text-[2.05rem]">
                  حمّل تطبيق ديفورا الآن
                  <br />
                  <span className="relative inline-block">
                    واعثر على منزلك القادم بسهولة
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-0.5 h-[7px] rounded-full bg-gold-300/70"
                    />
                  </span>
                </h2>

                <p className="mt-4 max-w-[400px] text-[14px] leading-[1.9] text-ink-muted">
                  تصفّح المشاريع والوحدات، قارن الخيارات، واحجز زيارتك مباشرة من التطبيق — كل ما تحتاجه في مكان واحد.
                </p>
              </Reveal>
            </div>

            {/* Col 2 – Center: Phone mockup 37% — overflows above banner */}
            <div className="relative z-20 w-[37%]">
              <img
                src="/mobile-transparent.png"
                alt="تطبيق ديفورا العقاري"
                className="absolute left-1/2 h-[440px] w-auto -translate-x-1/2 object-contain drop-shadow-[0_24px_56px_rgba(15,30,51,0.22)]"
                style={{ background: 'transparent', bottom: '-10px' }}
              />
            </div>

            {/* Col 3 – Left (last in RTL flex): QR card 20% */}
            <div className="relative z-10 flex w-[20%] items-center justify-center py-8">
              <div className="w-[110px] rounded-2xl border border-[#e8ddc8] bg-white p-3 text-center shadow-sm">
                <div className="flex items-center justify-center rounded-xl bg-canvas p-1.5 ring-1 ring-[#e8ddc8]">
                  <QrCode value={appUrl} size={74} className="h-[74px] w-[74px]" />
                </div>
                <p className="mt-2 text-[11px] font-medium leading-snug text-ink-muted">
                  امسح الرمز لتحميل التطبيق
                </p>
              </div>
            </div>

          </div>

          {/* ── Mobile layout ── */}
          <div className="flex flex-col items-end px-6 pb-4 pt-8 text-right lg:hidden">
            <Reveal>
              <Badge tone="gold">تجربة رقمية متكاملة</Badge>

              <h2 className="mt-3 text-[1.55rem] font-bold leading-[1.3] text-ink-strong sm:text-[1.7rem]">
                حمّل تطبيق ديفورا الآن
                <br />
                <span className="relative inline-block">
                  واعثر على منزلك القادم بسهولة
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-0.5 h-[6px] rounded-full bg-gold-300/70"
                  />
                </span>
              </h2>

              <p className="mt-3 text-[13px] leading-[1.9] text-ink-muted">
                تصفّح المشاريع والوحدات، قارن الخيارات، واحجز زيارتك مباشرة من التطبيق — كل ما تحتاجه في مكان واحد.
              </p>
            </Reveal>

            <div className="mt-5 flex w-full justify-center">
              <img
                src="/mobile-transparent.png"
                alt="تطبيق ديفورا العقاري"
                className="w-[180px] object-contain sm:w-[210px]"
                style={{ background: 'transparent' }}
              />
            </div>
          </div>

        </div>
      </Container>
    </section>
  );
}
