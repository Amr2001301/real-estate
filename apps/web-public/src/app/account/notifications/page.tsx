import { redirect } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { MeNotification, Paginated } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { NotificationCard } from '@/components/account/NotificationCard';
import { markAllNotificationsReadAction } from '@/lib/account-actions';

export const metadata = buildMetadata({
  title: 'الإشعارات',
  description: 'إشعاراتك في دار الفخامة.',
  robots: { index: false, follow: false },
});

function Header({ unreadCount }: { unreadCount: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl text-ink-strong">الإشعارات</h1>
        <p className="mt-1.5 text-sm text-ink-muted">تحديثات حسابك وطلباتك تظهر هنا.</p>
      </div>
      {unreadCount > 0 && (
        <form action={markAllNotificationsReadAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-strong transition-colors hover:border-gold-300 hover:text-gold-600"
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            تحديد الكل كمقروء
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Normalise the API response to an array. The backend now returns
 * `Paginated<MeNotification>` (`{ data, meta }`) but legacy comments in this
 * file assumed a plain array — calling `.filter()` on the wrapped response
 * crashed the page. The helper tolerates either shape (defence-in-depth) and
 * any other surprise becomes an empty list rather than a runtime error.
 */
function extractItems(value: unknown): MeNotification[] {
  if (Array.isArray(value)) return value as MeNotification[];
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: MeNotification[] }).data;
  }
  return [];
}

export default async function AccountNotificationsPage() {
  let raw: Paginated<MeNotification> | MeNotification[];
  try {
    raw = await authFetch<Paginated<MeNotification> | MeNotification[]>(
      '/me/notifications',
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        <Header unreadCount={0} />
        <ErrorState
          title="تعذّر تحميل الإشعارات حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const notifications = extractItems(raw);
  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return (
    <div className="space-y-6">
      <Header unreadCount={unreadCount} />

      {notifications.length === 0 ? (
        <EmptyState
          title="لا توجد إشعارات بعد"
          message="ستظهر هنا التحديثات المهمة المتعلقة بحسابك وطلباتك."
          icon={<Bell className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              العودة إلى لوحة الحساب
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
