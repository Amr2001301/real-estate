import { cookies } from 'next/headers';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessage } from '@/components/auth/auth-fields';
import LoginForm from './form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; reset?: string | string[]; expired?: string | string[] }>;
}) {
  const sp = await searchParams;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  const passwordReset = sp.reset === '1';
  const sessionExpired = sp.expired === '1';
  const c = await cookies();
  const lastCompanySlug = c.get('last_company_slug')?.value;

  return (
    <AuthShell eyebrow="لوحة التحكم" title="مرحبًا بعودتك" subtitle="سجّل دخولك لمتابعة مشاريعك ومبيعاتك وتحصيلاتك.">
      {(passwordReset || sessionExpired) && (
        <div className="mb-6">
          {passwordReset && (
            <AuthMessage tone="success">تم تغيير كلمة المرور بنجاح. سجّل دخولك بكلمة المرور الجديدة.</AuthMessage>
          )}
          {sessionExpired && <AuthMessage tone="warning">انتهت جلستك. سجّل دخولك من جديد.</AuthMessage>}
        </div>
      )}
      <LoginForm from={from} lastCompanySlug={lastCompanySlug} />
    </AuthShell>
  );
}
