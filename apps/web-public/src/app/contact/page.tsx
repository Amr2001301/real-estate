import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { PublicUnit, PublicProjectDetail } from '@/lib/api-types';
import { resolveContactPrefill } from '@/lib/contact-prefill';
import { getSession, isPortalRole } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Phone, Mail, Clock, MapPin, Navigation } from 'lucide-react';
import { extraT } from '@/messages/site-extra';
import { formatNumber } from '@/lib/format';
import { fetchBranding } from '@/lib/branding';
import { companyContact, getContactEmail, getContactAddress, telHref, whatsappHref } from '@/lib/contact';
import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { DEEP_BG } from '@/components/home/Hero';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { DetailHead } from '@/components/detail/DetailStats';
import { ContactForm, type ContactContext } from '@/components/contact/ContactForm';

export async function generateMetadata() {
  return pageMeta('contact', { path: '/contact' });
}

const REVALIDATE = 60;

type SearchParams = Promise<{ type?: string; projectId?: string; unitId?: string }>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

/**
 * Resolve display context. A unit also yields its parent project so a visit
 * request (which requires projectId) works even when only unitId is in the URL.
 */
async function resolveContext(projectId: string, unitId: string, tenantSlug: string): Promise<ContactContext> {
  if (unitId) {
    const res = await apiFetch<PublicUnit>(`/public/units/${unitId}`, { revalidate: REVALIDATE, tenantSlug });
    if (res.ok) {
      const u = res.data;
      const project = u.project ? pickAr(u.project.name) : '';
      const label = [unitTypeLabel(u.type), project].filter(Boolean).join(' · ') || `وحدة ${u.code}`;
      return {
        unitId,
        projectId: projectId || u.project?.id,
        projectName: project || undefined,
        unitLabel: label,
      };
    }
    return { unitId, projectId: projectId || undefined };
  }
  if (projectId) {
    const res = await apiFetch<PublicProjectDetail>(`/public/projects/${projectId}`, { revalidate: REVALIDATE, tenantSlug });
    return { projectId, projectName: res.ok ? pickAr(res.data.name) : undefined };
  }
  return {};
}

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const sp = await searchParams;
  // Context resolution, the profile prefill, and the session lookup have no
  // dependency on each other — run them in parallel so logged-in users don't
  // pay extra RTTs.
  const [context, initialValues, session, locale, branding] = await Promise.all([
    resolveContext(firstStr(sp.projectId), firstStr(sp.unitId), tenant.slug),
    resolveContactPrefill(),
    getSession(),
    getLocale(),
    fetchBranding(tenant.slug),
  ]);
  const m = siteT(locale);
  const mode = firstStr(sp.type) === 'visit' ? 'visit' : 'info';
  // Only portal roles (CLIENT/CUSTOMER) can call /me/* — staff roles browsing
  // /contact stay on the public path so they don't 403.
  const isAuthenticatedCustomer = Boolean(session && isPortalRole(session.role));

  const k = extraT(locale).contactPage2;
  const { phone, whatsapp } = companyContact(branding);
  const email = branding?.contactEmail?.trim() || getContactEmail();
  const c = extraT(locale).contact;
  // The company's own hours; the site's usual week until it sets them.
  const hours = branding?.officeHours?.[locale] || branding?.officeHours?.ar || `${c.days}${locale === 'en' ? ', ' : '، '}${c.time}`;
  const address = branding?.contactAddress?.[locale] || branding?.contactAddress?.ar || getContactAddress();
  const waMsg = extraT(locale).contact.whatsappMessage;

  return (
    <>
      <ListHero homeLabel={m.unitDetail.breadHome} title={m.contactPage.title} subtitle={m.contactPage.subtitle} />

      <section className="relative z-10 -mt-16 pb-16 sm:-mt-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="rounded-[1.75rem] border border-hairline bg-surface p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-10">
              <ContactForm
                context={context}
                mode={mode}
                initialValues={initialValues}
                isAuthenticatedCustomer={isAuthenticatedCustomer}
                locale={locale}
                plain
              />
            </div>

            <aside className="space-y-6">
              {(phone || whatsapp || email) && (
                <div className="relative overflow-hidden rounded-[1.75rem] p-7 text-white sm:p-8" style={{ background: DEEP_BG }}>
                  <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
                  <p className="relative text-[13px] font-semibold text-gold-300">{k.reach}</p>
                  <h2 className="relative mt-1.5 font-display text-[1.5rem] font-semibold leading-snug text-white">{k.reachTitle}</h2>
                  <div className="relative mt-6 space-y-3">
                    {phone && (
                      <a href={telHref(phone)} className="flex items-center gap-4 rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/15 transition-colors hover:bg-white/[0.14]">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-[#1B1206]"><Phone className="h-5 w-5" aria-hidden /></span>
                        <span><span className="block text-xs text-white/60">{k.callLabel}</span><span className="block text-[16px] font-semibold">{k.callNow}</span></span>
                      </a>
                    )}
                    {whatsapp && (
                      <a href={whatsappHref(whatsapp, waMsg)} className="flex items-center gap-4 rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/15 transition-colors hover:bg-white/[0.14]">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white"><WhatsAppIcon className="h-5 w-5" /></span>
                        <span><span className="block text-xs text-white/60">{k.waLabel}</span><span className="block text-[16px] font-semibold">{k.waNow}</span></span>
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className="flex items-center gap-4 rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/15 transition-colors hover:bg-white/[0.14]">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"><Mail className="h-5 w-5" aria-hidden /></span>
                        <span className="min-w-0"><span className="block text-xs text-white/60">{k.mailLabel}</span><span dir="ltr" className="block truncate text-[15px] font-semibold">{email}</span></span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {(hours || address) && (
                <div className="rounded-[1.75rem] border border-hairline bg-surface p-7 sm:p-8">
                  <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{k.office}</p>
                  <dl className="mt-4 divide-y divide-hairline">
                    {hours && (
                      <div className="flex items-start gap-3.5 py-4 first:pt-0">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" aria-hidden />
                        <div><dt className="text-[13px] text-ink-muted">{k.hours}</dt><dd className="mt-0.5 text-[15px] font-semibold text-ink-strong">{hours}</dd></div>
                      </div>
                    )}
                    {address && (
                      <div className="flex items-start gap-3.5 py-4 last:pb-0">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" aria-hidden />
                        <div>
                          <dt className="text-[13px] text-ink-muted">{k.address}</dt>
                          <dd className="mt-0.5 text-[15px] font-semibold text-ink-strong">{address}</dd>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline dark:text-gold-300">
                            <Navigation className="h-4 w-4" aria-hidden />
                            {k.directions}
                          </a>
                        </div>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </aside>
          </div>

          {/* What happens next */}
          <div className="mt-16">
            <DetailHead eyebrow={m.contactPage.eyebrow} title={k.nextTitle} />
            <ol className="grid gap-4 md:grid-cols-3">
              {k.next.map((step, i) => (
                <li key={step.t} className="rounded-[1.5rem] border border-hairline bg-surface p-7">
                  <span className="font-display text-[2.4rem] font-semibold leading-none text-gold-500">{formatNumber(i + 1, locale)}</span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-ink-strong">{step.t}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.8] text-ink-muted">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>
    </>
  );
}
