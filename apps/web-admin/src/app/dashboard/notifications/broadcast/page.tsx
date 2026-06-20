import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import BroadcastForm from './_form';

export const dynamic = 'force-dynamic';

export default async function BroadcastNotificationPage() {
  // requireAdmin allows ADMIN + SALES + SALES_MANAGER — restrict to ADMIN only.
  const session = await requireAdmin();
  if (session.role !== 'ADMIN') notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إرسال إشعار يدوي"
        description="أنشئ وأرسل إشعاراً مخصصاً إلى جمهور محدد. الإشعار يصل فوراً إلى قائمة إشعارات المستخدم."
        actions={
          <Link href="/dashboard/notifications">
            <Button variant="ghost" leftIcon={<ArrowRight className="h-4 w-4" />}>
              العودة للإشعارات
            </Button>
          </Link>
        }
      />
      <BroadcastForm />
    </div>
  );
}
