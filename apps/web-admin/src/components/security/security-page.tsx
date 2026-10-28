import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { getCompanyTimeZone } from '@/lib/currency';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { revokeOtherSessionsAction, revokeSessionAction } from '@/lib/security-actions';
import { SessionsList, type SessionRow } from './sessions-list';
import { ChangePasswordForm } from './change-password-form';
import { securityT } from './security-messages';
import { TwoFactorCard, type TwoFactorStatus } from './two-factor-card';
import { TwoFactorPolicyForm } from './two-factor-policy';
import { getSession } from '@/lib/session';

/** SES1 — «الأمان والأجهزة» for any staff member or broker: their devices and password. */
export async function SecurityPage({ home }: { home: string }) {
  const [locale, zone] = await Promise.all([getLocale(), getCompanyTimeZone()]);
  const m = securityT(locale);
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const [res, tfa, policy] = await Promise.all([
    safe(api.get<{ data: SessionRow[] }>('/auth/sessions')),
    safe(api.get<TwoFactorStatus>('/auth/2fa')),
    isAdmin ? safe(api.get<{ mode: string }>('/auth/2fa/policy')) : Promise.resolve(null),
  ]);
  const sessions = res.data?.data ?? [];
  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: home }, { label: m.title }]}
      />
      <PremiumPanel title={m.sessionsTitle} sub={m.sessionsSub(sessions.length)}>
        {res.error ? (
          <p role="alert" className="text-sm text-danger-600">{m.error}: {res.error}</p>
        ) : (
          <>
            <SessionsList sessions={sessions} locale={locale} timeZone={zone} revoke={revokeSessionAction} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted/60 p-3">
              <p className="text-[12.5px] text-slate-600">{others ? m.endOthersHint : m.none}</p>
              {others > 0 && (
                <form action={revokeOtherSessionsAction}>
                  <Button type="submit" variant="danger" size="sm">{m.endOthers}</Button>
                </form>
              )}
            </div>
          </>
        )}
      </PremiumPanel>
      {tfa.data?.available && (
        <PremiumPanel title={m.tfaTitle}>
          <TwoFactorCard status={tfa.data} locale={locale} />
        </PremiumPanel>
      )}
      {isAdmin && policy?.data && (
        <PremiumPanel title={m.policyTitle}>
          <TwoFactorPolicyForm mode={policy.data.mode} locale={locale} />
        </PremiumPanel>
      )}
      <PremiumPanel title={m.passwordTitle}>
        <ChangePasswordForm locale={locale} />
      </PremiumPanel>
    </div>
  );
}
