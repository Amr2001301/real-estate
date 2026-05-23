import type { Route } from 'next';
import { Building2, CalendarDays, Bell, Headset, Apple, Play } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';

const FEATURES = [
  { icon: Building2, label: 'متابعة العقارات' },
  { icon: CalendarDays, label: 'طلبات الزيارة' },
  { icon: Bell, label: 'التنبيهات' },
  { icon: Headset, label: 'الدعم' },
] as const;

/** Decorative CSS phone mockup — no image asset / dependency. */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-60 sm:w-64">
      {/* Soft gold glow behind the device */}
      <span className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-gold-200/40 blur-2xl" aria-hidden />
      <div className="rounded-[2.5rem] border border-white/60 bg-navy p-3 shadow-lift">
        <div className="overflow-hidden rounded-[2rem] bg-canvas">
          {/* Status bar / notch */}
          <div className="flex items-center justify-center py-2">
            <span className="h-1.5 w-16 rounded-full bg-navy/15" aria-hidden />
          </div>
          {/* Header */}
          <div className="px-4 pb-3">
            <div className="h-2.5 w-20 rounded-full bg-navy/20" />
            <div className="mt-2 h-2 w-28 rounded-full bg-navy/10" />
          </div>
          {/* Mini property cards */}
          <div className="space-y-3 px-4 pb-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-2.5 shadow-soft">
                <div
                  className="h-12 w-14 shrink-0 rounded-xl"
                  style={{ background: 'linear-gradient(135deg,#1C3050,#26405F)' }}
                  aria-hidden
                />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2 w-3/4 rounded-full bg-navy/15" />
                  <div className="h-2 w-1/2 rounded-full bg-navy/10" />
                  <div className="h-2 w-16 rounded-full bg-gold-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileAppPromo() {
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL;
  const googlePlay = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL;
  const hasLinks = Boolean(appStore || googlePlay);

  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-4xl border border-hairline bg-surface-soft">
          {/* Decorative warm shapes */}
          <span className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-200/30 blur-3xl" aria-hidden />
          <span className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-gold-100/40 blur-3xl" aria-hidden />

          <div className="relative grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:gap-6 lg:p-16">
            {/* Copy */}
            <Reveal>
              <div>
                <Badge tone="gold">قريبًا</Badge>
                <h2 className="mt-5 text-display-2 text-navy">تجربة دار الفخامة في تطبيق واحد</h2>
                <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
                  تابع وحداتك، طلبات الزيارة، العقود، الدفعات، والصيانة من مكان واحد بتجربة مصممة لراحتك.
                </p>

                <div className="mt-7 flex flex-wrap gap-2.5">
                  {FEATURES.map(({ icon: Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-2 text-sm text-navy shadow-soft"
                    >
                      <Icon className="h-4 w-4 text-gold-500" aria-hidden />
                      {label}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  {hasLinks ? (
                    <>
                      {appStore && (
                        <ButtonLink href={appStore as Route} variant="primary" size="md">
                          <Apple className="h-5 w-5" aria-hidden />
                          App Store
                        </ButtonLink>
                      )}
                      {googlePlay && (
                        <ButtonLink href={googlePlay as Route} variant="primary" size="md">
                          <Play className="h-5 w-5" aria-hidden />
                          Google Play
                        </ButtonLink>
                      )}
                    </>
                  ) : (
                    <>
                      <ButtonLink href={routes.contact} variant="primary" size="md">
                        سجّل اهتمامك
                      </ButtonLink>
                      <ButtonLink href={routes.projects} variant="outline" size="md">
                        تعرّف على التجربة
                      </ButtonLink>
                    </>
                  )}
                </div>

                {!hasLinks && (
                  <p className="mt-4 text-xs text-ink-muted">
                    سيتم تفعيل روابط التحميل عند إطلاق التطبيق.
                  </p>
                )}
              </div>
            </Reveal>

            {/* Phone mockup */}
            <Reveal delay={120}>
              <PhoneMockup />
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
