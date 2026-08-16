import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
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
  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <AuthShell
      title={m.auth.verifyEmail.title}
      subtitle={m.auth.verifyEmail.subtitle}
      switchPrompt={m.auth.verifyEmail.loginPrompt}
      switchLabel={m.auth.verifyEmail.loginLabel}
      switchHref={routes.login}
    >
      <VerifyEmailCard token={token} />
    </AuthShell>
  );
}
