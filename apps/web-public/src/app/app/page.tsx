import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Apple, Play, ArrowLeft } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { APP_STORE_URL, GOOGLE_PLAY_URL, detectMobileOS } from '@/lib/app-links';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = buildMetadata({
  path: '/app',
  title: 'التجربة الرقمية',
  description: 'ابدأ رحلتك العقارية مع دار الفخامة — تجربة رقمية واضحة وسريعة من البحث حتى القرار.',
  // Smart landing / redirect target — keep it out of the index.
  robots: { index: false, follow: true },
});

export default async function AppLandingPage() {
  const userAgent = (await headers()).get('user-agent') ?? '';
  const os = detectMobileOS(userAgent);

  // Once real store links exist, send mobile visitors straight to their store.
  if (os === 'ios' && APP_STORE_URL) redirect(APP_STORE_URL);
  if (os === 'android' && GOOGLE_PLAY_URL) redirect(GOOGLE_PLAY_URL);

  const storesReady = Boolean(APP_STORE_URL && GOOGLE_PLAY_URL);

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <Container className="mx-auto max-w-2xl text-center">
        <Badge tone="gold">تجربة رقمية متكاملة</Badge>
        <h1 className="mt-5 text-3xl font-bold leading-snug text-navy sm:text-4xl">
          ابدأ رحلتك العقارية مع دار الفخامة
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
          تصفّح المشاريع والوحدات، قارن الخيارات المناسبة، واحجز زيارتك — تجربة واضحة وسريعة من البحث حتى القرار.
        </p>

        {storesReady ? (
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            {APP_STORE_URL && (
              <a
                href={APP_STORE_URL}
                rel="noopener"
                className="inline-flex items-center gap-2.5 rounded-full bg-navy px-6 py-3.5 text-[15px] font-medium text-white shadow-soft transition-colors hover:bg-navy-700"
              >
                <Apple className="h-5 w-5" aria-hidden />
                App Store
              </a>
            )}
            {GOOGLE_PLAY_URL && (
              <a
                href={GOOGLE_PLAY_URL}
                rel="noopener"
                className="inline-flex items-center gap-2.5 rounded-full border border-navy/20 px-6 py-3.5 text-[15px] font-medium text-navy transition-colors hover:border-navy/40 hover:bg-navy/[0.03]"
              >
                <Play className="h-5 w-5" aria-hidden />
                Google Play
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <ButtonLink href={routes.units} variant="primary" size="lg">
                تصفّح الوحدات
              </ButtonLink>
              <ButtonLink href={routes.contact} variant="outline" size="lg">
                تحدث مع مستشار
              </ButtonLink>
            </div>
            <p className="mt-6 inline-flex items-center justify-center gap-1.5 text-sm text-ink-muted">
              التجربة متاحة الآن عبر الموقع — كل خطواتك العقارية في مكان واحد.
            </p>
          </>
        )}

        <div className="mt-10">
          <ButtonLink href={routes.home} variant="ghost" size="sm" className="text-ink-muted">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            العودة للرئيسية
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
