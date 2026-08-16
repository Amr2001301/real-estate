import { redirect } from 'next/navigation';
import { Mail, ShieldCheck, CalendarDays, Clock, BadgeCheck, MailWarning } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { MeProfile } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ErrorState } from '@/components/states/ErrorState';
import { ProfileForm } from '@/components/account/ProfileForm';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { ResendVerificationButton } from '@/components/account/ResendVerificationButton';

export const metadata = buildMetadata({
  title: 'الملف الشخصي',
  description: 'إدارة بياناتك في ديفورا.',
  robots: { index: false, follow: false },
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/** One read-only label/value row. */
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-ink-muted">{label}</div>
        <div className="truncate text-sm font-medium text-ink-strong" dir="auto">
          {value}
        </div>
      </div>
    </div>
  );
}

export default async function AccountProfilePage() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.profile;

  const ROLE_LABELS: Record<string, string> = m.roles;

  let profile: MeProfile;
  try {
    profile = await authFetch<MeProfile>('/users/me');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <AccountPageHeader title={m.title} description={m.description} />
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;

  return (
    <div className="space-y-8">
      <AccountPageHeader title={m.title} description={m.description} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Read-only account info */}
        <PremiumCard className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-ink-strong">{m.sectionTitle}</h2>
          <p className="mt-1 text-sm text-ink-muted">{m.sectionNote}</p>
          <div className="mt-4 divide-y divide-hairline">
            <InfoRow icon={<Mail className="h-4 w-4" aria-hidden />} label={m.emailLabel} value={profile.email ?? '—'} />
            {profile.email && (
              <div className="flex items-start gap-3 py-3.5">
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${profile.emailVerifiedAt ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                  {profile.emailVerifiedAt
                    ? <BadgeCheck className="h-4 w-4" aria-hidden />
                    : <MailWarning className="h-4 w-4" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-ink-muted">{m.emailStatus}</div>
                  <div className="text-sm font-medium text-ink-strong">
                    {profile.emailVerifiedAt ? `${m.emailVerified} ${formatDate(profile.emailVerifiedAt)}` : m.emailUnverified}
                  </div>
                  {!profile.emailVerifiedAt && <ResendVerificationButton />}
                </div>
              </div>
            )}
            <InfoRow icon={<ShieldCheck className="h-4 w-4" aria-hidden />} label={m.roleLabel} value={roleLabel} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" aria-hidden />} label={m.joinedLabel} value={formatDate(profile.createdAt)} />
            <InfoRow icon={<Clock className="h-4 w-4" aria-hidden />} label={m.lastLoginLabel} value={formatDate(profile.lastLoginAt)} />
          </div>
        </PremiumCard>

        {/* Editable fields */}
        <PremiumCard className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-ink-strong">{m.editTitle}</h2>
          <p className="mb-6 mt-1 text-sm text-ink-muted">{m.editSub}</p>
          <ProfileForm
            initialFullName={profile.fullName}
            initialPhone={profile.phone ?? ''}
            initialAvatarUrl={profile.avatarUrl ?? null}
          />
        </PremiumCard>
      </div>
    </div>
  );
}
