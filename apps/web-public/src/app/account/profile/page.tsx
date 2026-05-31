import { redirect } from 'next/navigation';
import { Mail, ShieldCheck, CalendarDays, Clock } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { MeProfile } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ErrorState } from '@/components/states/ErrorState';
import { ProfileForm } from '@/components/account/ProfileForm';

export const metadata = buildMetadata({
  title: 'الملف الشخصي',
  description: 'إدارة بياناتك في ديفورا.',
  robots: { index: false, follow: false },
});

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'عميل',
  CUSTOMER: 'عميل / مالك وحدة',
};

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
    <div className="flex items-center gap-3 py-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-gold-500">
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
  let profile: MeProfile;
  try {
    profile = await authFetch<MeProfile>('/users/me');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        <h1 className="text-2xl text-ink-strong">الملف الشخصي</h1>
        <ErrorState
          title="تعذّر تحميل بياناتك حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl text-ink-strong">الملف الشخصي</h1>

      {/* Read-only account info */}
      <PremiumCard className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink-strong">معلومات الحساب</h2>
        <p className="mt-1 text-sm text-ink-muted">هذه البيانات للعرض فقط ولا يمكن تعديلها من هنا.</p>
        <div className="mt-4 divide-y divide-hairline">
          <InfoRow icon={<Mail className="h-4 w-4" aria-hidden />} label="البريد الإلكتروني" value={profile.email ?? '—'} />
          <InfoRow icon={<ShieldCheck className="h-4 w-4" aria-hidden />} label="نوع الحساب" value={roleLabel} />
          <InfoRow icon={<CalendarDays className="h-4 w-4" aria-hidden />} label="تاريخ الانضمام" value={formatDate(profile.createdAt)} />
          <InfoRow icon={<Clock className="h-4 w-4" aria-hidden />} label="آخر تسجيل دخول" value={formatDate(profile.lastLoginAt)} />
        </div>
      </PremiumCard>

      {/* Editable fields */}
      <PremiumCard className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink-strong">تعديل البيانات</h2>
        <p className="mt-1 mb-5 text-sm text-ink-muted">يمكنك تحديث اسمك ورقم جوالك.</p>
        <ProfileForm initialFullName={profile.fullName} initialPhone={profile.phone ?? ''} />
      </PremiumCard>
    </div>
  );
}
