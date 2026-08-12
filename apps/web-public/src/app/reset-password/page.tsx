import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordCard } from '@/components/auth/ResetPasswordCard';

export const metadata = buildMetadata({
  title: 'إعادة تعيين كلمة المرور',
  description: 'أدخل كلمة المرور الجديدة لإتمام إعادة التعيين.',
  robots: { index: false, follow: false },
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';

  return (
    <AuthShell
      title="كلمة مرور جديدة"
      subtitle="أدخل كلمة المرور الجديدة لإتمام إعادة التعيين."
      switchPrompt="تذكّرت كلمة المرور؟"
      switchLabel="العودة إلى تسجيل الدخول"
      switchHref={routes.login}
    >
      <ResetPasswordCard token={token} />
    </AuthShell>
  );
}
