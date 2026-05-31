import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { AuthShell } from '@/components/auth/AuthShell';
import { CustomerAuthForm } from '@/components/auth/CustomerAuthForm';

export const metadata = buildMetadata({
  title: 'إنشاء حساب',
  description: 'أنشئ حسابك في ديفورا للوصول إلى العروض، طلبات الزيارة، ومتابعة اختياراتك.',
  robots: { index: false, follow: false },
});

export default function RegisterPage() {
  return (
    <AuthShell
      title="ابدأ رحلتك في عالم العقارات الفاخرة"
      subtitle="أنشئ حسابك للوصول إلى العروض، طلبات الزيارة، ومتابعة اختياراتك."
      switchPrompt="لديك حساب بالفعل؟"
      switchLabel="تسجيل الدخول"
      switchHref={routes.login}
    >
      <CustomerAuthForm mode="register" />
    </AuthShell>
  );
}
