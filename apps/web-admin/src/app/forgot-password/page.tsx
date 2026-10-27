import { AuthShell } from '@/components/auth/auth-shell';
import ForgotPasswordForm from './form';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="استعادة الحساب"
      title="نسيت كلمة المرور؟"
      subtitle="أدخل بريدك الإلكتروني وسنرسل إليك رابط إعادة التعيين."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
