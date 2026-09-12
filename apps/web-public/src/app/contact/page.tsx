import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { getResolvedTenant } from '@/lib/tenant';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { PublicUnit, PublicProjectDetail } from '@/lib/api-types';
import { resolveContactPrefill } from '@/lib/contact-prefill';
import { getSession, isPortalRole } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';
import { ContactForm, type ContactContext } from '@/components/contact/ContactForm';
import { ContactSupport } from '@/components/contact/ContactSupport';

export const metadata = buildMetadata({
  path: '/contact',
  title: 'تواصل معنا',
  description:
    'تواصل مع فريق ديفورا لطلب المعلومات أو حجز زيارة — نحن هنا لمساعدتك في اختيار المشروع أو الوحدة الأنسب لاحتياجك.',
});

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
    const res = await safeFetch<PublicUnit>(`/public/units/${unitId}`, { revalidate: REVALIDATE, tenantSlug });
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
    const res = await safeFetch<PublicProjectDetail>(`/public/projects/${projectId}`, { revalidate: REVALIDATE, tenantSlug });
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
  const [context, initialValues, session, locale] = await Promise.all([
    resolveContext(firstStr(sp.projectId), firstStr(sp.unitId), tenant.slug),
    resolveContactPrefill(),
    getSession(),
    getLocale(),
  ]);
  const m = siteT(locale);
  const mode = firstStr(sp.type) === 'visit' ? 'visit' : 'info';
  // Only portal roles (CLIENT/CUSTOMER) can call /me/* — staff roles browsing
  // /contact stay on the public path so they don't 403.
  const isAuthenticatedCustomer = Boolean(session && isPortalRole(session.role));

  return (
    <>
      <PageHero
        eyebrow={m.contactPage.eyebrow}
        title={m.contactPage.title}
        subtitle={m.contactPage.subtitle}
      />

      <Section tone="canvas">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ContactForm
              context={context}
              mode={mode}
              initialValues={initialValues}
              isAuthenticatedCustomer={isAuthenticatedCustomer}
              locale={locale}
            />
          </div>
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-28">
              <ContactSupport />
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
