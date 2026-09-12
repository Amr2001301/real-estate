import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { getResolvedTenant } from '@/lib/tenant';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordCard } from '@/components/auth/ForgotPasswordCard';

export const metadata = buildMetadata({
  title: 'نسيت كلمة المرور',
  description: 'أدخل بريدك الإلكتروني وسنرسل إليك رابط إعادة تعيين كلمة المرور.',
  robots: { index: false, follow: false },
});

export default async function ForgotPasswordPage() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <AuthShell
      title={m.auth.forgotPassword.title}
      subtitle={m.auth.forgotPassword.subtitle}
      switchPrompt={m.auth.forgotPassword.backPrompt}
      switchLabel={m.auth.forgotPassword.backLabel}
      switchHref={routes.login}
    >
      <ForgotPasswordCard />
    </AuthShell>
  );
}
