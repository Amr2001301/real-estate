import {
  Search,
  SlidersHorizontal,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Home,
  Heart,
  User,
  Bell,
  Scale,
  CalendarDays,
  ScanLine,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { siteUrl } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import { QrCode } from './QrCode';

/** A believable real-estate app screen built with HTML/CSS (Dar Al Fakhama palette). */
function AppPreviewScreen() {
  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold text-ink-strong/55">
        <span>٩:٤١</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-[2px] bg-navy/30" />
          <span className="h-2 w-2 rounded-full bg-navy/30" />
        </span>
      </div>

      {/* App top bar */}
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <div className="leading-tight">
          <p className="text-[9px] text-ink-muted">مرحباً بك في</p>
          <p className="text-xs font-bold text-navy">ديفورا</p>
        </div>
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-gold-600">
          <Bell className="h-4 w-4" aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold-500" />
        </span>
      </div>

      {/* Search */}
      <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2 shadow-soft">
        <Search className="h-3.5 w-3.5 text-gold-500" aria-hidden />
        <span className="flex-1 text-[10px] text-ink-muted">ابحث عن مشروع أو وحدة…</span>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-navy text-white">
          <SlidersHorizontal className="h-3 w-3" aria-hidden />
        </span>
      </div>

      {/* Category chips */}
      <div className="mb-2 flex gap-1.5 px-4">
        <span className="rounded-full bg-navy px-2.5 py-1 text-[9px] font-semibold text-white">الكل</span>
        <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[9px] font-semibold text-gold-600">سكني</span>
        <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[9px] text-ink-muted">تجاري</span>
        <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[9px] text-ink-muted">إداري</span>
      </div>

      {/* Featured card */}
      <div className="mx-4 mb-2 overflow-hidden rounded-xl border border-hairline bg-surface shadow-soft">
        <div className="relative h-20" style={{ background: 'linear-gradient(135deg,#16294A,#22395A)' }}>
          <span className="absolute right-2 top-2 rounded-full bg-gold-400 px-2 py-0.5 text-[8px] font-bold text-navy">
            مميز
          </span>
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[9px] font-medium text-white/90">
            <MapPin className="h-3 w-3" aria-hidden /> الرياض
          </span>
        </div>
        <div className="p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-navy">٢٬٤٥٠٬٠٠٠ ر.س</span>
            <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[8px] font-semibold text-success">متاحة</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 text-[9px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3 w-3 text-gold-500" aria-hidden /> ٣
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3 w-3 text-gold-500" aria-hidden /> ٢
            </span>
            <span className="inline-flex items-center gap-1">
              <Maximize className="h-3 w-3 text-gold-500" aria-hidden /> ١٨٠ م²
            </span>
          </div>
        </div>
      </div>

      {/* Compact list row */}
      <div className="mx-4 flex gap-2 rounded-xl border border-hairline bg-surface p-1.5 shadow-soft">
        <div
          className="h-11 w-12 shrink-0 rounded-lg"
          style={{ background: 'linear-gradient(135deg,#1C3050,#26405F)' }}
          aria-hidden
        />
        <div className="flex-1 py-0.5">
          <span className="block text-[10px] font-semibold text-ink-strong">شقة فاخرة · حي السفارات</span>
          <span className="mt-1 block text-[10px] font-bold text-gold-600">١٬٢٠٠٬٠٠٠ ر.س</span>
        </div>
      </div>

      {/* Spacer pushes the nav to the bottom */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <div className="flex items-center justify-around border-t border-hairline bg-surface px-4 py-2.5">
        <Home className="h-4 w-4 text-gold-500" aria-hidden />
        <Search className="h-4 w-4 text-ink-strong/30" aria-hidden />
        <Heart className="h-4 w-4 text-ink-strong/30" aria-hidden />
        <User className="h-4 w-4 text-ink-strong/30" aria-hidden />
      </div>
    </div>
  );
}

/** Premium dark device frame wrapping the app screen. */
function PhoneMockup() {
  return (
    <div className="relative w-full">
      {/* Soft drop shadow under the device */}
      <span aria-hidden className="pointer-events-none absolute inset-x-8 -bottom-4 h-10 rounded-[50%] bg-navy/25 blur-2xl" />

      <div className="relative rounded-[2.4rem] bg-navy p-2 shadow-lift ring-1 ring-white/10">
        {/* Dynamic-island */}
        <span aria-hidden className="absolute left-1/2 top-3.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black/85" />
        <div className="relative h-[392px] overflow-hidden rounded-[2rem] bg-canvas">
          <AppPreviewScreen />
        </div>
      </div>
    </div>
  );
}

/** Small floating micro-card that overlaps the phone for depth. */
function FloatingFeatureTag({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Scale;
  label: string;
  className: string;
}) {
  return (
    <div
      className={`absolute hidden items-center gap-2 rounded-full border border-hairline bg-surface/95 px-3 py-1.5 shadow-[0_12px_30px_-12px_rgba(15,30,51,0.32)] ring-1 ring-black/5 backdrop-blur sm:inline-flex ${className}`}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="text-xs font-semibold text-ink-strong">{label}</span>
    </div>
  );
}

/** Real, scannable QR card linking to the smart /app landing route. */
function QrCard({ href }: { href: string }) {
  return (
    <a
      href={href}
      rel="noopener"
      aria-label="ابدأ رحلتك العقارية — امسح الرمز"
      className="absolute -bottom-3 -left-6 hidden w-[124px] rounded-2xl border border-hairline bg-surface p-3 text-center shadow-lift transition-transform hover:-translate-y-0.5 sm:block"
    >
      <span className="mx-auto block w-fit rounded-lg bg-white p-1.5 ring-1 ring-gold-200/70">
        <QrCode value={href} size={64} className="h-16 w-16" />
      </span>
      <span className="mt-2 inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-ink-strong">
        <ScanLine className="h-3.5 w-3.5 text-gold-500" aria-hidden />
        امسح الرمز
      </span>
      <span className="mt-0.5 block text-[10px] leading-tight text-ink-muted">ابدأ رحلتك العقارية</span>
    </a>
  );
}

export function MobileAppPromo() {
  const appUrl = siteUrl(routes.app);

  return (
    <section className="py-10 sm:py-12 lg:py-14">
      <Container>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-hairline bg-surface shadow-lift">
          {/* Warm beige glow behind the visual area */}
          <span aria-hidden className="pointer-events-none absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-gold-200/30 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-gold-100/40 blur-3xl" />

          <div className="relative grid lg:grid-cols-2 lg:items-stretch">
            {/* Content — first child → right column in RTL / top on mobile */}
            <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
              <Reveal>
                <div className="max-w-xl">
                  <Badge tone="gold">تجربة رقمية متكاملة</Badge>
                  <h2 className="mt-5 text-3xl font-bold leading-snug text-ink-strong sm:text-4xl lg:text-[2.6rem]">
                    كل خطواتك العقارية في{' '}
                    <span className="relative inline-block whitespace-nowrap">
                      مكان واحد
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-1 h-2.5 rounded-full bg-gold-300/80 sm:h-3"
                      />
                    </span>
                  </h2>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-[17px]">
                    تصفّح المشاريع والوحدات بسهولة، قارن الخيارات المناسبة، احجز زيارة، وابدأ رحلتك العقارية بثقة مع تجربة
                    رقمية واضحة وسريعة.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3.5">
                    <ButtonLink href={routes.units} variant="primary" size="md">
                      ابدأ التصفّح
                    </ButtonLink>
                    <ButtonLink href={routes.contact} variant="outline" size="md">
                      تحدث مع مستشار
                    </ButtonLink>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Visual — second child → left column in RTL / below on mobile */}
            <div className="relative flex items-center justify-center px-6 pb-12 pt-2 sm:px-10 lg:px-8 lg:py-6">
              <Reveal delay={120}>
                <div className="relative mx-auto w-[250px] sm:w-[262px]">
                  {/* Gold glow behind the phone (painted first → sits behind) */}
                  <span aria-hidden className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gold-200/40 blur-3xl" />

                  <PhoneMockup />

                  {/* Floating micro-cards */}
                  <FloatingFeatureTag icon={Scale} label="مقارنة ذكية" className="-right-6 top-16" />
                  <FloatingFeatureTag icon={CalendarDays} label="طلبات زيارة" className="-left-6 top-1/2 -translate-y-1/2" />

                  {/* Real, scannable QR → /app */}
                  <QrCard href={appUrl} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
