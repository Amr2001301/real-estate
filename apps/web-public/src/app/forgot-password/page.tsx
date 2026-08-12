import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordCard } from '@/components/auth/ForgotPasswordCard';

export const metadata = buildMetadata({
  title: 'نسيت كلمة المرور',
  description: 'أدخل بريدك الإلكتروني وسنرسل إليك رابط إعادة تعيين كلمة المرور.',
  robots: { index: false, follow: false },
});

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="إعادة تعيين كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل إليك رابطًا لإعادة تعيين كلمة المرور."
      switchPrompt="تذكّرت كلمة المرور؟"
      switchLabel="العودة إلى تسجيل الدخول"
      switchHref={routes.login}
    >
      <ForgotPasswordCard />
    </AuthShell>
  );
}
