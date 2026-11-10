import Link from 'next/link';
import type { Route } from 'next';
import { Check, ShieldCheck } from 'lucide-react';
import { SITE } from '@/lib/seo';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { companyName, fetchBranding } from '@/lib/branding';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { DEEP_BG } from '@/components/home/Hero';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

interface AuthShellProps {
  /** The pitch on the photo side (sign in / sign up), or the form's heading with `formHeading`. */
  title: string;
  subtitle: string;
  switchPrompt: string;
  switchLabel: string;
  switchHref: string;
  /** For pages whose form has no heading of its own (forgot / reset / verify): the title goes over the form. */
  formHeading?: boolean;
  locale?: Locale;
  children: React.ReactNode;
}

/** A photo of one of the company's projects, else the site's own picture. */
async function panelPhoto(slug: string): Promise<string> {
  const res = await apiFetch<Paginated<PublicProjectListItem>>(`/public/projects?pageSize=6`, { revalidate: 300, tenantSlug: slug });
  const cover = res.ok ? res.data.data.find((p) => p.coverImage?.trim())?.coverImage : null;
  return cover || '/images/home/why.jpg';
}

/**
 * The sign-in / sign-up / password pages: one rounded panel — a photo of the
 * company's own project on its deep colour with its name, the pitch and what
 * an account gives (hidden on a phone), and the form on the other side.
 */
export async function AuthShell({
  title,
  subtitle,
  switchPrompt,
  switchLabel,
  switchHref,
  formHeading = false,
  locale = 'ar',
  children,
}: AuthShellProps) {
  const t = authT(locale).shell;
  const tenant = await getResolvedTenant();
  const [branding, photo] = tenant ? await Promise.all([fetchBranding(tenant.slug), panelPhoto(tenant.slug)]) : [null, '/images/home/why.jpg'];
  const brand = companyName(branding, locale, SITE.name);
  const pitchTitle = formHeading ? t.pitchTitle : title;
  const pitchSub = formHeading ? t.pitchSub : subtitle;

  return (
    <section className="bg-canvas pb-16 pt-24 sm:pt-28">
      <Container>
        <div className="flex overflow-hidden rounded-[2rem] border border-hairline bg-surface shadow-[0_30px_80px_-44px_rgba(0,0,0,0.45)] lg:min-h-[680px]">
          {/* The company's side */}
          <div className="relative isolate hidden flex-1 overflow-hidden text-white lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <span className="absolute inset-0 -z-10 opacity-[0.92]" style={{ background: `linear-gradient(160deg, ${DEEP_BG} 0%, color-mix(in srgb, rgb(var(--c-navy)) 40%, transparent) 100%)` }} aria-hidden />
            <span className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(70% 60% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />

            <div className="flex h-full flex-col justify-between p-11 xl:p-14">
              <span className="inline-flex items-center gap-2.5 font-display text-lg font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-gold-400" aria-hidden />
                {brand}
              </span>

              <div className="max-w-md">
                <h2 className="font-display text-[2.4rem] font-semibold leading-[1.3] text-white xl:text-[2.75rem]">{pitchTitle}</h2>
                <p className="mt-4 text-[17px] leading-[1.9] text-white/75">{pitchSub}</p>
                <ul className="mt-8 space-y-3.5">
                  {t.bullets.map((text) => (
                    <li key={text} className="flex items-center gap-3 text-[15px] text-white/90">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[#1B1206]">
                        <Check className="h-4 w-4" aria-hidden />
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="flex items-center gap-2 text-[13px] text-white/60">
                <ShieldCheck className="h-4 w-4 text-gold-300" aria-hidden />
                {t.privacyNote}
              </p>
            </div>
          </div>

          {/* The form */}
          <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 lg:w-[min(560px,48%)] lg:shrink-0">
            <div className="mx-auto w-full max-w-[420px]">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-gold-700 dark:text-gold-300 lg:hidden">
                <span className="h-2 w-2 rounded-full bg-gold-400" aria-hidden />
                {brand}
              </span>
              {formHeading ? (
                <div className="mb-7 mt-3 lg:mt-0">
                  <h1 className="font-display text-[1.9rem] font-semibold leading-tight text-ink-strong">{title}</h1>
                  <p className="mt-2 text-[15px] leading-[1.8] text-ink-muted">{subtitle}</p>
                </div>
              ) : (
                <h1 className="sr-only">{title}</h1>
              )}
              <div className={formHeading ? '' : 'mt-3 lg:mt-0'}>{children}</div>

              <p className="mt-9 border-t border-hairline pt-6 text-center text-[15px] text-ink-muted">
                {switchPrompt}{' '}
                <Link href={switchHref as Route} className="font-semibold text-navy underline-offset-4 hover:underline dark:text-gold-300">
                  {switchLabel}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
