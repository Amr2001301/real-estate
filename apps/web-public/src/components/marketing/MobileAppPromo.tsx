import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';

export function MobileAppPromo() {
  return (
    <section className="py-10 sm:py-12 lg:py-14">
      <Container>
        {/*
         * Bleed wrapper: py-20 (80px) creates overflow space above and below.
         * The card background starts at top-20, so the phone — which spans
         * inset-y-0 (full wrapper height) — bleeds 80px above the card top.
         * Nothing has overflow:hidden, so nothing clips the phone.
         */}
        <div className="relative py-20">

          {/* Card background — inset so phone overflows above it */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 top-20 rounded-[2rem] border border-[#e8ddc8] bg-[#fdf8f0] shadow-xl"
          />

          {/* ── Text column — right 56% on desktop ── */}
          <div className="relative z-10 flex w-full flex-col items-end px-8 pb-12 pt-8 text-right sm:px-12 lg:ml-[44%] lg:w-auto lg:pb-16 lg:pl-4 lg:pr-14 lg:pt-28">
            <Reveal>
              <Badge tone="gold">تجربة رقمية متكاملة</Badge>

              <h2 className="mt-5 text-4xl font-bold leading-[1.2] text-ink-strong sm:text-5xl lg:text-[3rem]">
                كل خطواتك العقارية
                <br />
                <span className="relative inline-block">
                  في مكان واحد
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1.5 h-3 rounded-full bg-gold-300/75"
                  />
                </span>
              </h2>

              <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-ink-muted">
                تصفّح المشاريع والوحدات بسهولة، قارن الخيارات المناسبة، احجز زيارة، وابدأ رحلتك العقارية بثقة مع تجربة رقمية واضحة وسريعة.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-end gap-4">
                <ButtonLink href={routes.units} variant="primary" size="lg">
                  ابدأ التصفّح
                </ButtonLink>
                <ButtonLink href={routes.contact} variant="outline" size="lg">
                  تحدث مع مستشار
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          {/* ── Phone — desktop: absolute, spans bleed zone, overflows above card ── */}
          <div className="pointer-events-none absolute inset-y-0 left-[3%] hidden w-[43%] items-center justify-center lg:flex">
            <img
              src="/mobile-transparent.png"
              alt="تطبيق ديفورا العقاري"
              className="max-h-[600px] w-auto object-contain drop-shadow-[0_32px_72px_rgba(15,30,51,0.22)]"
              style={{ background: 'transparent' }}
            />
          </div>

          {/* ── Phone — mobile/tablet: in-flow below text ── */}
          <div className="flex justify-center pb-6 pt-0 lg:hidden">
            <img
              src="/mobile-transparent.png"
              alt="تطبيق ديفورا العقاري"
              className="w-[240px] object-contain sm:w-[280px]"
              style={{ background: 'transparent' }}
            />
          </div>

        </div>
      </Container>
    </section>
  );
}
