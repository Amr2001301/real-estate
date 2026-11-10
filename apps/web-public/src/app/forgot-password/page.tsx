import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { getResolvedTenant } from '@/lib/tenant';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordCard } from '@/components/auth/ForgotPasswordCard';

export async function generateMetadata() {
  return pageMeta('forgotPassword', { robots: { index: false, follow: false } });
}

export default async function ForgotPasswordPage() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <AuthShell
      formHeading
      title={m.auth.forgotPassword.title}
      subtitle={m.auth.forgotPassword.subtitle}
      switchPrompt={m.auth.forgotPassword.backPrompt}
      switchLabel={m.auth.forgotPassword.backLabel}
      locale={locale}
      switchHref={routes.login}
    >
      <ForgotPasswordCard locale={locale} />
    </AuthShell>
  );
}
