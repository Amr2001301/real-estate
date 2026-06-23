import { routes } from '@/lib/routes';
import { siteUrl } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { QrCode } from './QrCode';

export function MobileAppPromo() {
  const appUrl = siteUrl(routes.app);

  return (
    /*
     * pt-24 (96px) > phone top-overflow (~90px) so the phone stays
     * within the section's whitespace and never clips into the nav.
     */
    <section className="relative pb-8 pt-24">
      <Container>
        {/*
         * Three clear zones:
         *   left 0–22%  → QR card (inside pale-blue area)
         *   left 22–50% → phone visual (absolute, overflows top)
         *   left 50–100%→ text (z-30, no overlap possible)
         *
         * Card height is locked by min-h-[290px].
         * Phone is absolute → cannot stretch the card.
         */}
        <div className="relative min-h-[290px] overflow-visible rounded-[28px] border border-[#dbe5ec] bg-white shadow-[0_4px_32px_-8px_rgba(15,30,51,0.08)]">

          {/* Soft pale-blue radial glow — fades naturally into white, no hard edge */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-[28px]"
            style={{
              background:
                'radial-gradient(circle at 22% 50%, rgba(220,240,250,0.95) 0%, rgba(220,240,250,0.70) 28%, rgba(255,255,255,0) 56%)',
            }}
          />

          {/* ── Zone 1: QR card ── physically far left, vertically centered */}
          <div className="absolute left-[60px] top-1/2 z-10 hidden -translate-y-1/2 lg:block">
            <div className="w-[126px] rounded-2xl border border-[#dbe5ec] bg-white p-3 text-center shadow-sm">
              <div className="flex items-center justify-center rounded-xl bg-white p-1 ring-1 ring-[#dbe5ec]">
                <QrCode value={appUrl} size={86} className="h-[86px] w-[86px]" />
              </div>
              <p className="mt-2 text-[11px] font-medium leading-snug text-slate-500">
                امسح الرمز
                <br />
                لتحميل التطبيق
              </p>
            </div>
          </div>

          {/* ── Zone 2: Phone — between QR and text, overflows card top ── */}
          {/*
           * center at left-[36%], -translate-x-1/2 → phone horizontal center = 36% of card
           * -translate-y-[56%] → rises 56% × 420px = 235px above card center (145px) = 90px above card top
           * phone right edge ≈ 36% + ~11% (half PNG width) = ~47% → safely left of text zone (50%+)
           */}
          <img
            src="/mobile-transparent.png"
            alt="تطبيق ديفورا العقاري"
            className="absolute left-[36%] top-[48%] z-20 hidden h-[400px] w-auto -translate-x-1/2 -translate-y-[58%] object-contain drop-shadow-[0_20px_56px_rgba(15,30,51,0.18)] lg:block lg:h-[420px]"
            style={{ background: 'transparent' }}
          />

          {/* ── Zone 3: Text — right 50%, z-30 guarantees no overlap ── */}
          <div className="relative z-30 ml-auto flex min-h-[290px] w-full flex-col items-end justify-center px-8 py-10 text-right lg:w-[50%] lg:py-0 lg:pl-6 lg:pr-16">

            <h2 className="text-2xl font-bold leading-[1.3] text-ink-strong sm:text-3xl lg:text-[1.9rem]">
              احصل على أفضل تجربة
              <br />
              <span className="relative inline-block">
                حمل تطبيق ديفورا الآن!
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1 h-2 rounded-full bg-gold-300/70"
                />
              </span>
            </h2>

            <p className="mt-3 max-w-[360px] text-[14.5px] leading-relaxed text-ink-muted">
              اجعل تجربة العقارات أسهل وأسرع مع قوائم دقيقة، بحث ذكي، ومميزات لإدارة ممتلكاتك. انطلق الآن!
            </p>

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
