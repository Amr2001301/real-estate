import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { can } from '@/lib/permissions';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import BroadcastForm from './_form';

export const dynamic = 'force-dynamic';

export default async function BroadcastNotificationPage() {
  // requireAdmin allows ADMIN + SALES + SALES_MANAGER — restrict to ADMIN only.
  const session = await requireAdmin();
  if (session.role !== 'ADMIN' && !(await can('notifications:send'))) notFound();

  const [locale, usersRes] = await Promise.all([
    getLocale(),
    safe(api.get<Paged<User>>('/users?pageSize=100&active=true')),
  ]);
  const users = (usersRes.data?.data ?? []).map((u) => ({ id: u.id, fullName: u.fullName, role: u.role }));
  const m = uiT(locale).notificationsBroadcast;

  return (
    <div className="flex flex-col gap-6">
      <PremiumPageHero
        title={m.pageTitle}
        description={m.pageDescription}
        breadcrumbs={[
          { label: m.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbNotifications, href: '/dashboard/notifications' },
          { label: m.breadcrumbBroadcast },
        ]}
      />
      <BroadcastForm locale={locale} users={users} />
    </div>
  );
}
