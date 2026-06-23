import { routes } from '@/lib/routes';
import { siteUrl } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import { QrCode } from './QrCode';

export function MobileAppPromo() {
  const appUrl = siteUrl(routes.app);

  return (
    <section className="relative pb-10 pt-24">
      <Container>
        <div className="relative min-h-[290px] overflow-visible rounded-[28px] border border-[#e8ddc8] bg-[#fffaf2] shadow-[0_8px_48px_-16px_rgba(15,30,51,0.12)]">

          {/* Warm gold glow behind the phone area */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
            <span className="absolute -left-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-gold-200/45 blur-3xl" />
            <span className="absolute left-1/3 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-gold-100/30 blur-2xl" />
          </div>

          {/* ── QR card — far left, vertically centered ── */}
          <div className="absolute left-[52px] top-1/2 z-10 hidden -translate-y-1/2 lg:block">
            <div className="w-[118px] rounded-2xl border border-[#e8ddc8] bg-white p-3 text-center shadow-sm">
              <div className="flex items-center justify-center rounded-xl bg-canvas p-1.5 ring-1 ring-[#e8ddc8]">
                <QrCode value={appUrl} size={78} className="h-[78px] w-[78px]" />
              </div>
              <p className="mt-2 text-[11px] font-medium leading-snug text-ink-muted">
                امسح الرمز
                <br />
                لتحميل التطبيق
              </p>
            </div>
          </div>

          {/* ── Phone — overflows above banner top ── */}
          <img
            src="/mobile-transparent.png"
            alt="تطبيق ديفورا العقاري"
            className="absolute left-[36%] top-[48%] z-20 hidden h-[400px] w-auto -translate-x-1/2 -translate-y-[58%] object-contain drop-shadow-[0_24px_56px_rgba(15,30,51,0.22)] lg:block lg:h-[420px]"
            style={{ background: 'transparent' }}
          />

          {/* ── Text — right 50%, warm theme ── */}
          <div className="relative z-30 ml-auto flex min-h-[290px] w-full flex-col items-end justify-center px-8 py-10 text-right lg:w-[50%] lg:py-0 lg:pl-6 lg:pr-14">
            <Reveal>
              <Badge tone="gold">تجربة رقمية متكاملة</Badge>

              <h2 className="mt-4 text-2xl font-bold leading-[1.2] text-ink-strong sm:text-3xl lg:text-[2.1rem]">
                كل خطواتك العقارية
                <br />
                <span className="relative inline-block">
                  في مكان واحد
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1 h-2.5 rounded-full bg-gold-300/75 sm:h-3"
                  />
                </span>
              </h2>

              <p className="mt-4 max-w-[340px] text-[14px] leading-relaxed text-ink-muted">
                تصفّح المشاريع والوحدات بسهولة، قارن الخيارات المناسبة، احجز زيارة، وابدأ رحلتك العقارية بثقة مع تجربة رقمية واضحة وسريعة.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <ButtonLink href={routes.units} variant="primary" size="md">
                  ابدأ التصفّح
                </ButtonLink>
                <ButtonLink href={routes.contact} variant="outline" size="md">
                  تحدث مع مستشار
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          {/* ── Mobile: phone in-flow below text ── */}
          <div className="flex justify-center pb-8 pt-2 lg:hidden">
            <img
              src="/mobile-transparent.png"
              alt="تطبيق ديفورا العقاري"
              className="w-[200px] object-contain sm:w-[240px]"
              style={{ background: 'transparent' }}
            />
          </div>

        </div>
      </Container>
    </section>
  );
}
