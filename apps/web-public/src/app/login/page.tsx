import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginCard } from '@/components/auth/LoginCard';
import { InlineNotice } from '@/components/states/InlineNotice';

export const metadata = buildMetadata({
  title: 'تسجيل الدخول',
  description: 'سجّل دخولك إلى حسابك في ديفورا لمتابعة طلباتك وزياراتك ووحداتك المفضلة.',
  robots: { index: false, follow: false },
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function isPasswordReset(v: string | string[] | undefined): boolean {
  return v === '1' || (Array.isArray(v) && v[0] === '1');
}

/**
 * True only for a safe internal `/account…` return target (same guard the
 * middleware/login action use). Drives a gentle "session ended / login
 * required" notice when the user was bounced here from a protected page —
 * without claiming the session definitively expired (they may simply be
 * unauthenticated) and without trusting arbitrary `from` values.
 */
function isAccountFrom(from: string): boolean {
  if (!from || from.length > 2048) return false;
  if (!from.startsWith('/')) return false;
  if (from.startsWith('//') || from.startsWith('/\\')) return false;
  const pathOnly = from.split(/[?#]/, 1)[0] ?? '';
  return pathOnly === '/account' || pathOnly.startsWith('/account/');
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const showSessionNotice = isAccountFrom(firstStr(sp.from));
  const showResetNotice = isPasswordReset(sp.reset);

  return (
    <AuthShell
      title="مرحبًا بك في عالم من الرقي العقاري"
      subtitle="سجّل دخولك لمتابعة طلباتك، زياراتك، ووحداتك المفضلة."
      switchPrompt="ليس لديك حساب؟"
      switchLabel="إنشاء حساب جديد"
      switchHref={routes.register}
    >
      {showResetNotice && (
        <InlineNotice tone="success" className="mb-5">
          تم تغيير كلمة المرور بنجاح. سجّل دخولك بكلمة المرور الجديدة.
        </InlineNotice>
      )}
      {showSessionNotice && !showResetNotice && (
        <InlineNotice tone="info" className="mb-5">
          انتهت الجلسة أو يلزم تسجيل الدخول للمتابعة.
        </InlineNotice>
      )}
      <LoginCard />
    </AuthShell>
  );
}
