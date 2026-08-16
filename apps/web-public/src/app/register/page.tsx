import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { AuthShell } from '@/components/auth/AuthShell';
import { CustomerAuthForm } from '@/components/auth/CustomerAuthForm';

export const metadata = buildMetadata({
  title: 'إنشاء حساب',
  description: 'أنشئ حسابك في ديفورا للوصول إلى العروض، طلبات الزيارة، ومتابعة اختياراتك.',
  robots: { index: false, follow: false },
});

export default async function RegisterPage() {
  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <AuthShell
      title={m.auth.register.title}
      subtitle={m.auth.register.subtitle}
      switchPrompt={m.auth.register.switchPrompt}
      switchLabel={m.auth.register.switchLabel}
      switchHref={routes.login}
    >
      <CustomerAuthForm mode="register" />
    </AuthShell>
  );
}
