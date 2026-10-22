import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeFetch } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { getResolvedTenant } from '@/lib/tenant';
import { Container } from '@/components/ui/Container';
import { SignFlow, type SignView } from './SignFlow';

// A private page: never indexed, never cached.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [tenant, locale] = await Promise.all([getResolvedTenant(), getLocale()]);
  if (!tenant) notFound();
  const res = await safeFetch<SignView>(`/public/e-sign/${encodeURIComponent(token)}`, {
    tenantSlug: tenant.slug,
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.error.status === 404 || res.error.status === 400) notFound();
    return (
      <Container className="py-24 text-center text-ink-muted">{res.error.message}</Container>
    );
  }
  return (
    <Container className="py-10 sm:py-14">
      <SignFlow token={token} view={res.data} locale={locale === 'en' ? 'en' : 'ar'} />
    </Container>
  );
}
