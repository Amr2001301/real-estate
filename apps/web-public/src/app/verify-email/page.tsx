import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyEmailCard } from '@/components/auth/VerifyEmailCard';

export const metadata = buildMetadata({
  title: 'تأكيد البريد الإلكتروني',
  description: 'تأكيد بريدك الإلكتروني في ديفورا.',
  robots: { index: false, follow: false },
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';

  return (
    <AuthShell
      title="تأكيد البريد الإلكتروني"
      subtitle="انقر على الرابط الذي أرسلناه إلى بريدك الإلكتروني لتفعيل حسابك."
      switchPrompt="هل تريد الدخول إلى حسابك؟"
      switchLabel="تسجيل الدخول"
      switchHref={routes.login}
    >
      <VerifyEmailCard token={token} />
    </AuthShell>
  );
}
