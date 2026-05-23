import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginCard } from '@/components/auth/LoginCard';

export const metadata = buildMetadata({
  title: 'تسجيل الدخول',
  description: 'سجّل دخولك إلى حسابك في دار الفخامة لمتابعة طلباتك وزياراتك ووحداتك المفضلة.',
  robots: { index: false, follow: false },
});

export default function LoginPage() {
  return (
    <AuthShell
      title="مرحبًا بك في عالم من الرقي العقاري"
      subtitle="سجّل دخولك لمتابعة طلباتك، زياراتك، ووحداتك المفضلة."
      switchPrompt="ليس لديك حساب؟"
      switchLabel="إنشاء حساب جديد"
      switchHref={routes.register}
    >
      <LoginCard />
    </AuthShell>
  );
}
