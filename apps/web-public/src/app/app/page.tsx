import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Apple, Play, ArrowLeft, Check } from 'lucide-react';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { detectMobileOS, storeLinks } from '@/lib/app-links';
import { companyName, fetchBranding } from '@/lib/branding';
import { SITE } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { CoverImage } from '@/components/ui/CoverImage';
import { DEEP_BG } from '@/components/home/Hero';
import { apiFetch } from '@/lib/api-server';
import { pickAr } from '@/lib/format';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';

export async function generateMetadata() {
  return pageMeta('app', { path: '/app', robots: { index: false, follow: true } });
}

export default async function AppLandingPage() {
  const h = await headers();
  const os = detectMobileOS(h.get('user-agent') ?? '');
  // The company's own app when it is in the stores (MA4), else the shared one.
  const slug = h.get('x-resolved-tenant-slug') ?? '';
  const branding = slug ? await fetchBranding(slug) : null;
  const { appStore: appStoreUrl, googlePlay: googlePlayUrl } = storeLinks(branding?.mobileApp);

  // Once real store links exist, send mobile visitors straight to their store.
  if (os === 'ios' && appStoreUrl) redirect(appStoreUrl);
  if (os === 'android' && googlePlayUrl) redirect(googlePlayUrl);

  const storesReady = Boolean(appStoreUrl || googlePlayUrl);
  const name = companyName(branding, 'ar', SITE.name);
  const projects = slug ? await apiFetch<Paginated<PublicProjectListItem>>('/public/projects?pageSize=6', { revalidate: 300, tenantSlug: slug }) : null;
  const shots = projects?.ok ? projects.data.data.filter((p) => p.coverImage?.trim()) : [];
  const features = ['تصفّح المشاريع والوحدات بأسعارها وخطط سدادها', 'احفظ المفضلة وقارن حتى 3 وحدات', 'احجز معاينة وتابع طلباتك وزياراتك', 'تابع عقدك وأقساطك وطلبات الصيانة'];

  return (
    <section className="pb-20 pt-24 sm:pt-28">
      <Container>
        <div className="relative isolate flex flex-col overflow-hidden rounded-[2rem] text-white lg:min-h-[620px] lg:flex-row" style={{ background: DEEP_BG }}>
          <span className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(60% 80% at 0% 100%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
          <span className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '44px 44px' }} aria-hidden />

          <div className="flex flex-1 flex-col justify-center px-7 py-12 sm:px-14 lg:py-16">
            <span className="inline-flex w-fit rounded-full bg-white/[0.12] px-3.5 py-1.5 text-xs font-semibold text-gold-300 ring-1 ring-white/20">تطبيق {name}</span>
            <h1 className="mt-5 max-w-xl font-display text-[2.2rem] font-semibold leading-[1.3] text-white sm:text-[3rem]">عقارك كله في جيبك</h1>
            <p className="mt-4 max-w-lg text-[17px] leading-[1.9] text-white/75">
              تصفّح المشاريع والوحدات، قارن، واحجز معاينتك — وبعد الشراء تابع عقدك وأقساطك من مكان واحد.
            </p>
            <ul className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px] text-white/90">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[#1B1206]"><Check className="h-3.5 w-3.5" aria-hidden /></span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {storesReady ? (
                <>
                  {appStoreUrl && (
                    <a href={appStoreUrl} rel="noopener" className="inline-flex h-14 items-center gap-3 rounded-2xl bg-black px-5 text-white ring-1 ring-white/20 transition-colors hover:bg-neutral-900">
                      <Apple className="h-7 w-7" aria-hidden />
                      <span className="flex flex-col leading-tight"><span className="text-[11px] text-white/70">حمّله من</span><span className="text-[16px] font-semibold">App Store</span></span>
                    </a>
                  )}
                  {googlePlayUrl && (
                    <a href={googlePlayUrl} rel="noopener" className="inline-flex h-14 items-center gap-3 rounded-2xl bg-black px-5 text-white ring-1 ring-white/20 transition-colors hover:bg-neutral-900">
                      <Play className="h-6 w-6" aria-hidden />
                      <span className="flex flex-col leading-tight"><span className="text-[11px] text-white/70">متاح على</span><span className="text-[16px] font-semibold">Google Play</span></span>
                    </a>
                  )}
                </>
              ) : (
                <>
                  <a href={routes.units} className="inline-flex h-12 items-center rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206] hover:bg-gold-300">تصفّح الوحدات</a>
                  <a href={routes.contact} className="inline-flex h-12 items-center rounded-2xl bg-white/[0.12] px-6 text-[15px] font-semibold text-white ring-1 ring-white/25 hover:bg-white/20">تحدث مع مستشار</a>
                </>
              )}
            </div>
            {!storesReady && <p className="mt-4 text-sm text-white/60">التطبيق قريبًا على المتاجر — كل خطواتك متاحة الآن عبر الموقع.</p>}
          </div>

          {/* A phone drawn in CSS with the company's own projects */}
          <div className="relative flex items-end justify-center px-8 pt-4 lg:w-[44%] lg:items-center lg:pt-0" aria-hidden>
            <div className="relative h-[520px] w-[260px] translate-y-10 rounded-[2.6rem] border-[8px] border-neutral-900 bg-canvas shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] lg:translate-y-0">
              <span className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
              <div className="h-full overflow-hidden rounded-[2rem] text-ink-strong">
                <div className="px-4 pb-3 pt-9 text-start" style={{ background: DEEP_BG }}>
                  <p className="text-[10px] text-white/70">أهلًا بك في</p>
                  <p className="font-display text-[15px] font-semibold text-white">{name}</p>
                  <div className="mt-3 h-7 rounded-lg bg-white/15" />
                </div>
                <div className="space-y-2.5 p-3">
                  {(shots.length ? shots : [null, null, null]).slice(0, 3).map((p, i) => (
                    <div key={i} className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-hairline">
                      <div className="relative h-[88px]">
                        <CoverImage src={p?.coverImage} alt="" className="absolute inset-0 h-full" />
                      </div>
                      <div className="px-2.5 py-2 text-start">
                        <p className="truncate text-[11px] font-semibold">{p ? pickAr(p.name, '', 'ar') : name}</p>
                        <p className="text-[9px] text-ink-muted">{p ? `${p.availableUnitsCount} وحدة متاحة` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href={routes.home} className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-muted hover:text-ink-strong">
            <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden />
            العودة للرئيسية
          </a>
        </div>
      </Container>
    </section>
  );
}
