import { AuthShell } from '@/components/auth/auth-shell';
import ResetPasswordForm from './form';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';

  return (
    <AuthShell
      eyebrow="استعادة الحساب"
      title="كلمة مرور جديدة"
      subtitle="أدخل كلمة المرور الجديدة لإتمام إعادة التعيين."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
