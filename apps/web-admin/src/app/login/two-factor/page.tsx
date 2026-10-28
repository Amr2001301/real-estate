import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { heldChallenge } from '@/lib/auth-session';
import TwoFactorForm from './form';

/** TFA1 — after the password: the 6-digit code from the authenticator app. */
export default async function TwoFactorPage() {
  if (!(await heldChallenge()).challenge) redirect('/login');
  return (
    <AuthShell eyebrow="التحقق بخطوتين" title="أدخل كود التحقق" subtitle="افتح تطبيق المصادقة على موبايلك واكتب الكود المكوّن من 6 أرقام.">
      <TwoFactorForm />
    </AuthShell>
  );
}
