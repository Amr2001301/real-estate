import { routes } from '@/lib/routes';
import { siteUrl } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/motion/Reveal';
import { QrCode } from './QrCode';
import { extraT } from '@/messages/site-extra';
import { CompanyMark } from '@/components/layout/CompanyMark';
import { cn } from '@/lib/cn';
import type { BrandingData } from '@/lib/branding';
import type { Locale } from '@/lib/locale';

/**
 * A phone drawn in CSS with the company's own mark: the old picture was the
 * platform's app (its logo and screens), which a company's site must not show.
 */
function PhoneMock({ branding, name, className }: { branding?: BrandingData; name: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative aspect-[9/19] rounded-[2.4rem] border-[7px] border-neutral-900 bg-navy shadow-[0_28px_62px_-18px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <span className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-neutral-900" />
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <CompanyMark branding={branding} name={name} size={64} className="rounded-2xl" />
        <span className="text-[15px] font-bold leading-snug text-white">{name}</span>
        <span className="h-1.5 w-12 rounded-full bg-gold-400/80" />
      </div>
    </div>
  );
}

/** The company's app promo. `appName` is its app's name (or the company's). */
export function MobileAppPromo({
  locale = 'ar',
  appName,
  branding,
}: {
  locale?: Locale;
  appName: string;
  branding?: BrandingData;
}) {
  const raw = extraT(locale).mobilePromo;
  const fill = (s: string) => s.replaceAll('{app}', appName);
  const t = { ...raw, badge: fill(raw.badge), titleA: fill(raw.titleA), alt: fill(raw.alt) };
  const appUrl = siteUrl(routes.app);

  return (
    <section className="relative pb-8 pt-32 lg:pt-36">
      <Container>
        <div
          dir="rtl"
          className="relative overflow-visible rounded-[28px] border border-[#e8ddc8] bg-[#fffaf2] shadow-[0_10px_52px_-18px_rgba(15,30,51,0.16)] dark:border-hairline dark:bg-surface dark:shadow-none"
        >
          {/* Warm abstract background */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] dark:opacity-25"
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
                <span className="inline-flex rounded-full bg-gold-100/80 px-4 py-1.5 text-[13px] font-semibold text-[#9a7a35] dark:bg-gold-400/15 dark:text-gold-300">
                  {t.badge}
                </span>

                <h2 className="mt-4 text-[1.95rem] font-bold leading-[1.25] text-ink-strong xl:text-[2.18rem]">
                  {t.titleA}
                  <br />
                  <span className="relative inline-block whitespace-nowrap">
                    {t.titleB}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-1 h-[8px] rounded-full bg-gold-300/70"
                    />
                  </span>
                </h2>

                <p className="mt-5 max-w-[470px] text-[15px] leading-[1.9] text-ink-muted">
                  {t.body}
                </p>
              </Reveal>
            </div>

            {/* Phone hero - center */}
            <div className="relative z-20 w-[34%] overflow-visible">
              <PhoneMock
                branding={branding}
                name={appName}
                className="absolute bottom-[-8px] left-1/2 w-[215px] -translate-x-1/2 xl:w-[232px]"
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

                <p className="mt-3 max-w-[120px] text-[13px] font-semibold leading-snug text-[#6B6256]">
                  {t.scan}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center lg:hidden">
            <Reveal>
              <span className="inline-flex rounded-full bg-gold-100/80 px-4 py-1.5 text-[12px] font-semibold text-[#9a7a35] dark:bg-gold-400/15 dark:text-gold-300">
                {t.badge}
              </span>

              <h2 className="mt-4 text-[1.65rem] font-bold leading-[1.3] text-ink-strong sm:text-[1.9rem]">
                {t.titleA}
                <br />
                <span className="relative inline-block">
                  {t.titleB}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[6px] rounded-full bg-gold-300/70"
                  />
                </span>
              </h2>

              <p className="mx-auto mt-4 max-w-[430px] text-[13px] leading-[1.9] text-ink-muted sm:text-[14px]">
                {t.body}
              </p>
            </Reveal>

            <div className="relative mt-6 flex w-full justify-center">
              <span
                aria-hidden
                className="absolute bottom-2 left-1/2 h-36 w-56 -translate-x-1/2 rounded-full bg-gold-100/40 blur-2xl"
              />

              <PhoneMock branding={branding} name={appName} className="relative z-10 w-[200px] sm:w-[220px]" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}