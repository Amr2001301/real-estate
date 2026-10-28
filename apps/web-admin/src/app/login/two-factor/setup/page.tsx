import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { heldChallenge } from '@/lib/auth-session';
import TwoFactorSetupForm from './form';

/** TFA1 — the company requires two-step sign-in and this account has not set it up yet. */
export default async function TwoFactorSetupPage() {
  // Once the code is in, the session cookies replace the challenge and the page
  // re-renders: it stays, so the recovery codes can be read before going on.
  const signedIn = (await cookies()).has('access_token');
  if (!(await heldChallenge()).challenge && !signedIn) redirect('/login');
  return (
    <AuthShell eyebrow="التحقق بخطوتين" title="فعّل التحقق بخطوتين" subtitle="شركتك بتطلب كود من تطبيق مصادقة مع كلمة المرور. ده بيتعمل مرة واحدة.">
      <TwoFactorSetupForm />
    </AuthShell>
  );
}
