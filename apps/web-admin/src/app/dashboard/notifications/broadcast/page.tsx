import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { PremiumPageHero } from '@/components/premium';
import BroadcastForm from './_form';

export const dynamic = 'force-dynamic';

export default async function BroadcastNotificationPage() {
  // requireAdmin allows ADMIN + SALES + SALES_MANAGER — restrict to ADMIN only.
  const session = await requireAdmin();
  if (session.role !== 'ADMIN') notFound();

  const locale = await getLocale();
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
        actions={
          <Link href="/dashboard/notifications">
            <Button variant="ghost" leftIcon={<ArrowRight className="h-4 w-4" />}>
              {m.backBtn}
            </Button>
          </Link>
        }
      />
      <BroadcastForm locale={locale} />
    </div>
  );
}
