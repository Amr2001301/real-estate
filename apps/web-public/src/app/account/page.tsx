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
  FileText,
  Wallet,
  Wrench,
  Bell,
} from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel, formatPrice } from '@/lib/format';
import type {
  FavoriteItem,
  Paginated,
  MeVisitRequest,
  MeInfoRequest,
  VisitProjectRef,
  VisitUnitRef,
  MeContract,
  MeDepositsResponse,
  MeMaintenanceRequest,
  MeNotification,
} from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { SummaryTile } from '@/components/account/SummaryTile';
import { RecentRow } from '@/components/account/RecentRow';
import { StatusBadge } from '@/components/account/StatusBadge';
import { notificationTitle } from '@/components/account/NotificationCard';

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

function contractTitle(c: MeContract): string {
  const project = c.unit?.building?.phase?.project ?? null;
  if (project) return pickAr(project.name) || `عقد رقم ${c.contractNumber ?? '—'}`;
  if (c.unit) return `${unitTypeLabel(c.unit.type)} · ${c.unit.code}`;
  return `عقد رقم ${c.contractNumber ?? '—'}`;
}

/** Small "view all" header link for a recent section. */
function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-ink-strong">{title}</h2>
      <Link href={href as Route} className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:text-gold-500">
        عرض الكل
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const isCustomer = session.role === 'CUSTOMER';

  // ── Client sources (every portal user) ──────────────────────────────────
  const [favsR, visitsR, reqsR] = await Promise.allSettled([
    authFetch<FavoriteItem[]>('/me/favorites'),
    authFetch<Paginated<MeVisitRequest>>('/me/visit-requests?page=1&pageSize=3'),
    authFetch<Paginated<MeInfoRequest>>('/me/info-requests?page=1&pageSize=3'),
  ]);
  if ([favsR, visitsR, reqsR].some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) {
    redirect('/login');
  }

  const favorites = favsR.status === 'fulfilled' ? favsR.value : null;
  const visits = visitsR.status === 'fulfilled' ? visitsR.value : null;
  const requests = reqsR.status === 'fulfilled' ? reqsR.value : null;

  const favoritesCount = favorites ? favorites.length : null;
  const visitsCount = visits ? visits.meta.total : null;
  const requestsCount = requests ? requests.meta.total : null;

  const recentVisits = visits?.data ?? [];
  const recentRequests = requests?.data ?? [];
  const hasClientActivity = recentVisits.length > 0 || recentRequests.length > 0;

  // ── Customer sources (CUSTOMER only — CLIENT never calls these) ──────────
  let contractsCount: number | null = null;
  let depositsTotalText: string | null = null;
  let maintenanceCount: number | null = null;
  let unreadCount: number | null = null;
  let recentContracts: MeContract[] = [];
  let recentMaintenance: MeMaintenanceRequest[] = [];
  let recentNotifications: MeNotification[] = [];

  if (isCustomer) {
    const [contractsR, depositsR, maintR, notifsR] = await Promise.allSettled([
      authFetch<Paginated<MeContract>>('/contracts/me/contracts?page=1&pageSize=3'),
      authFetch<MeDepositsResponse>('/me/deposits'),
      authFetch<Paginated<MeMaintenanceRequest>>('/me/maintenance-requests?page=1&pageSize=3'),
      authFetch<MeNotification[]>('/me/notifications'),
    ]);
    if ([contractsR, depositsR, maintR, notifsR].some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) {
      redirect('/login');
    }

    const contracts = contractsR.status === 'fulfilled' ? contractsR.value : null;
    const deposits = depositsR.status === 'fulfilled' ? depositsR.value : null;
    const maintenance = maintR.status === 'fulfilled' ? maintR.value : null;
    const notifications = notifsR.status === 'fulfilled' ? notifsR.value : null;

    contractsCount = contracts ? contracts.meta.total : null;
    depositsTotalText = deposits ? formatPrice(deposits.totals.totalAmount) : null;
    maintenanceCount = maintenance ? maintenance.meta.total : null;
    unreadCount = notifications ? notifications.filter((n) => n.readAt === null).length : null;

    recentContracts = contracts?.data ?? [];
    recentMaintenance = maintenance?.data ?? [];
    recentNotifications = (notifications ?? []).slice(0, 3);
  }

  const hasCustomerActivity =
    recentContracts.length > 0 || recentMaintenance.length > 0 || recentNotifications.length > 0;

  return (
    <div className="space-y-8">
      {/* Overview + quick actions (greeting lives in the layout hero/sidebar) */}
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

      {/* Client summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile icon={Heart} label="المفضلة" value={favoritesCount} href={routes.accountFavorites} />
        <SummaryTile icon={CalendarClock} label="طلبات الزيارة" value={visitsCount} href={routes.accountVisits} />
        <SummaryTile icon={MessageSquareText} label="الاستفسارات" value={requestsCount} href={routes.accountRequests} />
      </div>

      {/* Client recent activity / guidance (guidance only for non-customers) */}
      {hasClientActivity ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {recentVisits.length > 0 && (
            <section className="space-y-3">
              <SectionHead title="أحدث الزيارات" href={routes.accountVisits} />
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
              <SectionHead title="أحدث الاستفسارات" href={routes.accountRequests} />
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
        !isCustomer && (
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
        )
      )}

      {/* ── Customer (post-purchase) section ── */}
      {isCustomer && (
        <div className="space-y-6 border-t border-hairline pt-8">
          <div>
            <h2 className="text-xl font-semibold text-ink-strong">خدمات ما بعد الشراء</h2>
            <p className="mt-1 text-sm text-ink-muted">عقاراتك وعقودك ودفعاتك وطلبات الصيانة.</p>
          </div>

          {/* Customer summary tiles (real counts/values; CTA on failure) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile icon={FileText} label="العقود" value={contractsCount} href={routes.accountContracts} />
            <SummaryTile icon={Wallet} label="إجمالي المدفوعات" value={null} valueText={depositsTotalText} href={routes.accountDeposits} />
            <SummaryTile icon={Wrench} label="طلبات الصيانة" value={maintenanceCount} href={routes.accountMaintenance} />
            <SummaryTile icon={Bell} label="إشعارات غير مقروءة" value={unreadCount} href={routes.accountNotifications} />
          </div>

          {/* Customer quick links */}
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={routes.accountProperty} variant="outline" size="sm">
              <Building2 className="h-4 w-4" aria-hidden />
              عقاراتي
            </ButtonLink>
            <ButtonLink href={routes.accountMaintenanceNew} variant="outline" size="sm">
              <Wrench className="h-4 w-4" aria-hidden />
              طلب صيانة جديد
            </ButtonLink>
          </div>

          {/* Customer recent activity, or guidance when none */}
          {hasCustomerActivity ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {recentContracts.length > 0 && (
                <section className="space-y-3">
                  <SectionHead title="أحدث العقود" href={routes.accountContracts} />
                  <div className="space-y-3">
                    {recentContracts.map((c) => (
                      <RecentRow
                        key={c.id}
                        icon={FileText}
                        title={contractTitle(c)}
                        subtitle={`عقد رقم ${c.contractNumber ?? '—'}`}
                        trailing={<span className="text-xs font-medium text-ink-strong">{formatPrice(c.totalAmount)}</span>}
                      />
                    ))}
                  </div>
                </section>
              )}

              {recentMaintenance.length > 0 && (
                <section className="space-y-3">
                  <SectionHead title="أحدث طلبات الصيانة" href={routes.accountMaintenance} />
                  <div className="space-y-3">
                    {recentMaintenance.map((m) => (
                      <RecentRow
                        key={m.id}
                        icon={Wrench}
                        title={m.category ? pickAr(m.category.name) || 'طلب صيانة' : 'طلب صيانة'}
                        subtitle={m.unit ? `${unitTypeLabel(m.unit.type)} · ${m.unit.code}` : undefined}
                        trailing={<StatusBadge status={m.status} />}
                      />
                    ))}
                  </div>
                </section>
              )}

              {recentNotifications.length > 0 && (
                <section className="space-y-3 lg:col-span-2">
                  <SectionHead title="أحدث الإشعارات" href={routes.accountNotifications} />
                  <div className="space-y-3">
                    {recentNotifications.map((n) => (
                      <RecentRow
                        key={n.id}
                        icon={Bell}
                        title={notificationTitle(n.templateCode)}
                        subtitle={formatDateTime(n.createdAt)}
                        trailing={
                          n.readAt === null ? (
                            <span className="h-2 w-2 rounded-full bg-gold-500" aria-hidden />
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <EmptyState
              title="لا يوجد نشاط بعد"
              message="ستظهر هنا عقودك ودفعاتك وطلبات الصيانة بعد إتمام إجراءات الشراء."
              icon={<Building2 className="h-6 w-6" aria-hidden />}
              action={
                <ButtonLink href={routes.accountProperty} variant="outline" size="md">
                  الذهاب إلى عقاراتي
                </ButtonLink>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
