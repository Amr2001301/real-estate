import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Heart,
  CalendarClock,
  MessageSquareText,
  Building2,
  Home,
  UserCircle2,
  ArrowLeft,
} from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type {
  FavoriteItem,
  Paginated,
  MeVisitRequest,
  MeInfoRequest,
  VisitProjectRef,
  VisitUnitRef,
} from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { SummaryTile } from '@/components/account/SummaryTile';
import { RecentRow } from '@/components/account/RecentRow';
import { StatusBadge } from '@/components/account/StatusBadge';

export const metadata = buildMetadata({
  title: 'لوحة الحساب',
  description: 'منطقة العميل في دار الفخامة.',
  robots: { index: false, follow: false },
});

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function entityTitle(project: VisitProjectRef | null, unit: VisitUnitRef | null, fallback: string): string {
  if (project) return pickAr(project.name) || fallback;
  if (unit) return `${unitTypeLabel(unit.type)} · ${unit.code}`;
  return fallback;
}

function entityIcon(project: VisitProjectRef | null, unit: VisitUnitRef | null) {
  return unit ? Home : project ? Building2 : MessageSquareText;
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch summary sources in parallel; tolerate partial failures, bounce on auth
  // failure. Tokens stay server-side (authFetch). Identity/greeting come from the
  // layout hero + sidebar, so we don't refetch /users/me here.
  const [favsR, visitsR, reqsR] = await Promise.allSettled([
    authFetch<FavoriteItem[]>('/me/favorites'),
    authFetch<Paginated<MeVisitRequest>>('/me/visit-requests?page=1&pageSize=3'),
    authFetch<Paginated<MeInfoRequest>>('/me/info-requests?page=1&pageSize=3'),
  ]);

  const results = [favsR, visitsR, reqsR];
  if (results.some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) {
    redirect('/login');
  }

  const favorites = favsR.status === 'fulfilled' ? favsR.value : null;
  const visits = visitsR.status === 'fulfilled' ? visitsR.value : null;
  const requests = reqsR.status === 'fulfilled' ? reqsR.value : null;

  // Real counts only — null when the source failed (SummaryTile shows a CTA).
  const favoritesCount = favorites ? favorites.length : null;
  const visitsCount = visits ? visits.meta.total : null;
  const requestsCount = requests ? requests.meta.total : null;

  const recentVisits = visits?.data ?? [];
  const recentRequests = requests?.data ?? [];
  const hasActivity = recentVisits.length > 0 || recentRequests.length > 0;

  return (
    <div className="space-y-8">
      {/* Overview + quick actions (the greeting lives in the layout hero/sidebar) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl text-ink-strong">نظرة عامة</h1>
          <p className="mt-1.5 text-sm text-ink-muted">ملخص نشاطك وروابط سريعة.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={routes.projects} variant="primary" size="md">
            تصفّح المشاريع
          </ButtonLink>
          <ButtonLink href={routes.units} variant="outline" size="md">
            استكشف الوحدات
          </ButtonLink>
          <ButtonLink href={routes.accountProfile} variant="ghost" size="md">
            تعديل البيانات
          </ButtonLink>
        </div>
      </div>

      {/* Real-count summary tiles (each links to its section) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile icon={Heart} label="المفضلة" value={favoritesCount} href={routes.accountFavorites} />
        <SummaryTile icon={CalendarClock} label="طلبات الزيارة" value={visitsCount} href={routes.accountVisits} />
        <SummaryTile icon={MessageSquareText} label="الاستفسارات" value={requestsCount} href={routes.accountRequests} />
      </div>

      {/* Recent activity, or friendly guidance when there's none */}
      {hasActivity ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {recentVisits.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink-strong">أحدث الزيارات</h2>
                <Link
                  href={routes.accountVisits as Route}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:text-gold-500"
                >
                  عرض الكل
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <div className="space-y-3">
                {recentVisits.map((v) => (
                  <RecentRow
                    key={v.id}
                    icon={entityIcon(v.project, v.unit)}
                    title={entityTitle(v.project, v.unit, 'طلب زيارة')}
                    subtitle={`الموعد المفضل: ${formatDateTime(v.preferredDate)}`}
                    trailing={<StatusBadge status={v.requestStatus} />}
                  />
                ))}
              </div>
            </section>
          )}

          {recentRequests.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink-strong">أحدث الاستفسارات</h2>
                <Link
                  href={routes.accountRequests as Route}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:text-gold-500"
                >
                  عرض الكل
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <div className="space-y-3">
                {recentRequests.map((r) => (
                  <RecentRow
                    key={r.id}
                    icon={entityIcon(r.project, r.unit)}
                    title={entityTitle(r.project, r.unit, 'استفسار عام')}
                    subtitle={r.message}
                    trailing={<span className="text-xs text-ink-muted">{formatDateTime(r.createdAt)}</span>}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <EmptyState
          title="ابدأ رحلتك العقارية"
          message="تصفّح المشاريع والوحدات، واحفظ ما يهمّك أو اطلب زيارة، وستظهر متابعتك هنا."
          icon={<UserCircle2 className="h-6 w-6" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={routes.projects} variant="primary" size="md">
                تصفّح المشاريع
              </ButtonLink>
              <ButtonLink href={routes.units} variant="outline" size="md">
                استكشف الوحدات
              </ButtonLink>
            </div>
          }
        />
      )}
    </div>
  );
}
