import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordCard } from '@/components/auth/ResetPasswordCard';

export async function generateMetadata() {
  return pageMeta('resetPassword', { robots: { index: false, follow: false } });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';
  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <AuthShell
      formHeading
      title={m.auth.resetPassword.title}
      subtitle={m.auth.resetPassword.subtitle}
      switchPrompt={m.auth.resetPassword.backPrompt}
      switchLabel={m.auth.resetPassword.backLabel}
      locale={locale}
      switchHref={routes.login}
    >
      <ResetPasswordCard token={token} locale={locale} />
    </AuthShell>
  );
}
