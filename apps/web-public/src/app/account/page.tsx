import { redirect } from 'next/navigation';
import { LogOut, UserCircle2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { getSession, type SessionRole } from '@/lib/session';
import { logoutAction } from '@/lib/auth-actions';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';

export const metadata = buildMetadata({
  title: 'حسابي',
  description: 'منطقة حسابك في دار الفخامة.',
  robots: { index: false, follow: false },
});

const ROLE_LABELS: Partial<Record<SessionRole, string>> = {
  CLIENT: 'عميل',
  CUSTOMER: 'عميل (مالك وحدة)',
};

/**
 * Minimal authenticated landing stub. Its only job right now is to prove the
 * auth flow works end-to-end (session read + logout). Client/Customer feature
 * pages are intentionally not built yet.
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const roleLabel = ROLE_LABELS[session.role] ?? session.role;

  return (
    <Section tone="canvas">
      <Container>
        <div className="mx-auto max-w-xl">
          <PremiumCard className="p-8 text-center sm:p-10">
            <IconCircle tone="navy" className="mx-auto h-14 w-14">
              <UserCircle2 className="h-7 w-7" aria-hidden />
            </IconCircle>

            <h1 className="mt-5 text-2xl text-ink-strong">
              مرحبًا{session.fullName ? `، ${session.fullName}` : ''}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              نوع الحساب: <span className="font-medium text-ink-strong">{roleLabel}</span>
            </p>

            <p className="mx-auto mt-5 max-w-md leading-relaxed text-ink-muted">
              نعمل حاليًا على تجهيز منطقة حسابك — قريبًا ستتمكن من متابعة طلباتك وزياراتك
              ووحداتك المفضلة من هنا.
            </p>

            <form action={logoutAction} className="mt-8 flex justify-center">
              <Button type="submit" variant="outline" size="md">
                <LogOut className="h-5 w-5" aria-hidden />
                تسجيل الخروج
              </Button>
            </form>
          </PremiumCard>
        </div>
      </Container>
    </Section>
  );
}
