import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { getResolvedTenant } from '@/lib/tenant';
import { AuthShell } from '@/components/auth/AuthShell';
import { CustomerAuthForm } from '@/components/auth/CustomerAuthForm';

export async function generateMetadata() {
  return pageMeta('register', { robots: { index: false, follow: false } });
}

export default async function RegisterPage() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <AuthShell
      title={m.auth.register.title}
      subtitle={m.auth.register.subtitle}
      switchPrompt={m.auth.register.switchPrompt}
      switchLabel={m.auth.register.switchLabel}
      locale={locale}
      switchHref={routes.login}
    >
      <CustomerAuthForm mode="register" locale={locale} />
    </AuthShell>
  );
}
