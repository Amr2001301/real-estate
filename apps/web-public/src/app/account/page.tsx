import { redirect } from 'next/navigation';
import {
  Heart,
  CalendarClock,
  MessageSquareText,
  BookmarkCheck,
  Building2,
  Home,
  UserCircle2,
  FileText,
  Wallet,
  Wrench,
  Bell,
} from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { authFetch, AuthError } from '@/lib/api-auth';
import { extractPaginatedData } from '@/lib/extract-paginated';
import { pickAr, unitTypeLabel, formatPrice } from '@/lib/format';
import type {
  FavoriteItem,
  Paginated,
  MeVisitRequest,
  MeInfoRequest,
  MeReservation,
  VisitProjectRef,
  VisitUnitRef,
  MeContract,
  MeDepositsResponse,
  MeMaintenanceRequest,
  MeNotification,
  MeInstallment,
} from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeading } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';
import { Reveal } from '@/components/motion/Reveal';
import { EmptyState } from '@/components/states/EmptyState';
import { SummaryTile } from '@/components/account/SummaryTile';
import { PropertyFocus } from '@/components/account/PropertyFocus';
import { RecentRow } from '@/components/account/RecentRow';
import { RecentPanel } from '@/components/account/RecentPanel';
import { StatusBadge } from '@/components/account/StatusBadge';
import { notificationTitle } from '@/components/account/NotificationCard';

export const metadata = buildMetadata({
  title: 'لوحة الحساب',
  description: 'منطقة العميل في ديفورا.',
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

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const isCustomer = session.role === 'CUSTOMER';

  // ── Client sources (every portal user — CLIENT and CUSTOMER) ───────────
  // P7 — reservations live here (not in the customer-only section) because
  // CLIENT users can hold reservations without yet being promoted to CUSTOMER.
  const [favsR, visitsR, reqsR, resvR] = await Promise.allSettled([
    authFetch<FavoriteItem[]>('/me/favorites'),
    authFetch<Paginated<MeVisitRequest>>('/me/visit-requests?page=1&pageSize=3'),
    authFetch<Paginated<MeInfoRequest>>('/me/info-requests?page=1&pageSize=3'),
    authFetch<Paginated<MeReservation>>('/me/reservations?page=1&pageSize=3'),
  ]);
  if ([favsR, visitsR, reqsR, resvR].some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) {
    redirect('/login');
  }

  const favorites = favsR.status === 'fulfilled' ? favsR.value : null;
  const visits = visitsR.status === 'fulfilled' ? visitsR.value : null;
  const requests = reqsR.status === 'fulfilled' ? reqsR.value : null;
  const reservations = resvR.status === 'fulfilled' ? resvR.value : null;

  const favoritesCount = favorites ? favorites.length : null;
  const visitsCount = visits ? visits.meta.total : null;
  const requestsCount = requests ? requests.meta.total : null;
  const reservationsCount = reservations ? reservations.meta.total : null;

  const recentVisits = visits?.data ?? [];
  const recentRequests = requests?.data ?? [];
  const recentReservations = reservations?.data ?? [];
  const hasClientActivity =
    recentVisits.length > 0 || recentRequests.length > 0 || recentReservations.length > 0;

  // ── Customer sources (CUSTOMER only — CLIENT never calls these) ──────────
  let contractsCount: number | null = null;
  let depositsTotalText: string | null = null;
  let maintenanceCount: number | null = null;
  let unreadCount: number | null = null;
  let recentContracts: MeContract[] = [];
  let recentMaintenance: MeMaintenanceRequest[] = [];
  let recentNotifications: MeNotification[] = [];
  // Owner-first focus band: the customer's primary owned unit (derived from
  // their first contract) + the single most urgent upcoming installment.
  let primaryContract: MeContract | null = null;
  let nextInstallment: MeInstallment | null = null;
  let unpaidCount = 0;

  if (isCustomer) {
    const [contractsR, depositsR, maintR, notifsR, instR] = await Promise.allSettled([
      authFetch<Paginated<MeContract>>('/contracts/me/contracts?page=1&pageSize=3'),
      authFetch<MeDepositsResponse>('/me/deposits'),
      authFetch<Paginated<MeMaintenanceRequest>>('/me/maintenance-requests?page=1&pageSize=3'),
      // P10 — accept either the historical flat-array shape OR the current
      // `Paginated<MeNotification>` shape; the helper normalises both into a
      // plain array. Calling .filter() directly on the wrapped response is
      // what crashed the dashboard at src/app/account/page.tsx:150.
      authFetch<Paginated<MeNotification> | MeNotification[]>('/me/notifications'),
      // Installment schedule — used only to surface the next due payment in the
      // focus band. Failure is non-fatal (band hides the payment side).
      authFetch<Paginated<MeInstallment>>('/me/installments?page=1&pageSize=200'),
    ]);
    if ([contractsR, depositsR, maintR, notifsR, instR].some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) {
      redirect('/login');
    }

    const contracts = contractsR.status === 'fulfilled' ? contractsR.value : null;
    const deposits = depositsR.status === 'fulfilled' ? depositsR.value : null;
    const maintenance = maintR.status === 'fulfilled' ? maintR.value : null;
    const installments = instR.status === 'fulfilled' ? instR.value.data : [];

    // Next due = earliest-dated unpaid installment (an overdue one naturally
    // sorts first), so the band always shows the most urgent obligation.
    const unpaid = installments.filter((i) => i.status !== 'PAID');
    unpaidCount = unpaid.length;
    nextInstallment =
      unpaid.length > 0
        ? unpaid.reduce((earliest, i) => (i.dueDate < earliest.dueDate ? i : earliest))
        : null;
    // Defence-in-depth: anything other than an array OR `{data: T[]}` falls
    // through to `[]`, so the dashboard renders zeros instead of throwing.
    const notificationsRaw = notifsR.status === 'fulfilled' ? notifsR.value : null;
    const notifications = extractPaginatedData<MeNotification>(notificationsRaw);
    const notificationsLoaded = notifsR.status === 'fulfilled';

    contractsCount = contracts ? contracts.meta.total : null;
    depositsTotalText = deposits ? formatPrice(deposits.totals.totalAmount) : null;
    maintenanceCount = maintenance ? maintenance.meta.total : null;
    // Unread count is derived from the normalised list (bounded by the
    // backend's default pageSize=20). When the fetch failed we keep null so
    // the SummaryTile renders an em-dash instead of "0", matching the other
    // tiles' loading-failed semantics.
    unreadCount = notificationsLoaded
      ? notifications.filter((n) => n.readAt === null).length
      : null;

    recentContracts = contracts?.data ?? [];
    recentMaintenance = maintenance?.data ?? [];
    recentNotifications = notifications.slice(0, 3);
    primaryContract = recentContracts[0] ?? null;
  }

  const hasCustomerActivity =
    recentContracts.length > 0 || recentMaintenance.length > 0 || recentNotifications.length > 0;

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ── Overview (greeting lives in the layout hero) ── */}
      <section className="space-y-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading as="h1" eyebrow="حسابك" title="نظرة عامة" description="ملخص نشاطك وأحدث ما يخصّك في مكان واحد." />
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={routes.projects} variant="primary" size="sm">
              تصفّح المشاريع
            </ButtonLink>
            <ButtonLink href={routes.units} variant="outline" size="sm">
              استكشف الوحدات
            </ButtonLink>
          </div>
        </div>

        {/* Journey stats — P7: Reservations visible to CLIENT + CUSTOMER. */}
        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4" childClassName="h-full" step={70}>
          <SummaryTile icon={Heart} label="المفضلة" value={favoritesCount} href={routes.accountFavorites} />
          <SummaryTile icon={CalendarClock} label="طلبات الزيارة" value={visitsCount} href={routes.accountVisits} />
          <SummaryTile icon={MessageSquareText} label="الاستفسارات" value={requestsCount} href={routes.accountRequests} />
          <SummaryTile icon={BookmarkCheck} label="الحجوزات" value={reservationsCount} href={routes.accountReservations} />
        </Stagger>
      </section>

      {/* Client recent activity / guidance (guidance only for non-customers) */}
      {hasClientActivity ? (
        <section className="space-y-7">
          <SectionHeading eyebrow="متابعة" title="نشاطك الأخير" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {recentVisits.length > 0 && (
              <Reveal className="h-full">
                <RecentPanel icon={CalendarClock} title="أحدث الزيارات" href={routes.accountVisits} className="h-full">
                  {recentVisits.map((v) => (
                    <RecentRow
                      key={v.id}
                      href={routes.accountVisits}
                      icon={entityIcon(v.project, v.unit)}
                      title={entityTitle(v.project, v.unit, 'طلب زيارة')}
                      subtitle={`الموعد المفضل: ${formatDateTime(v.preferredDate)}`}
                      trailing={<StatusBadge status={v.requestStatus} />}
                    />
                  ))}
                </RecentPanel>
              </Reveal>
            )}
            {recentRequests.length > 0 && (
              <Reveal className="h-full">
                <RecentPanel icon={MessageSquareText} title="أحدث الاستفسارات" href={routes.accountRequests} className="h-full">
                  {recentRequests.map((r) => (
                    <RecentRow
                      key={r.id}
                      href={routes.accountRequests}
                      icon={entityIcon(r.project, r.unit)}
                      title={entityTitle(r.project, r.unit, 'استفسار عام')}
                      subtitle={r.message}
                      trailing={<span className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(r.createdAt)}</span>}
                    />
                  ))}
                </RecentPanel>
              </Reveal>
            )}
            {recentReservations.length > 0 && (
              <Reveal className="lg:col-span-2">
                <RecentPanel icon={BookmarkCheck} title="أحدث الحجوزات" href={routes.accountReservations}>
                  {recentReservations.map((r) => (
                    <RecentRow
                      key={r.id}
                      href={routes.accountReservations}
                      icon={BookmarkCheck}
                      title={`حجز رقم ${r.reservationNumber ?? '—'}`}
                      subtitle={r.unit ? `${unitTypeLabel(r.unit.type)} · ${r.unit.code}` : undefined}
                      trailing={<StatusBadge status={r.status} />}
                    />
                  ))}
                </RecentPanel>
              </Reveal>
            )}
          </div>
        </section>
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
        <section className="space-y-7 border-t border-hairline pt-12 sm:pt-14">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="ملكيتك"
              title="خدمات ما بعد الشراء"
              description="عقاراتك وعقودك ودفعاتك وطلبات الصيانة في مكان واحد."
            />
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={routes.accountProperty} variant="outline" size="sm">
                <Building2 className="h-4 w-4" aria-hidden />
                عقاراتي
              </ButtonLink>
              <ButtonLink href={routes.accountMaintenanceNew} variant="gold" size="sm">
                <Wrench className="h-4 w-4" aria-hidden />
                طلب صيانة جديد
              </ButtonLink>
            </div>
          </div>

          {/* Owner-first focus: the primary owned unit + next payment due. */}
          {primaryContract && (
            <Reveal>
              <PropertyFocus contract={primaryContract} nextInstallment={nextInstallment} unpaidCount={unpaidCount} />
            </Reveal>
          )}

          {/* Customer stats — compact secondary row beneath the focus band. */}
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4" childClassName="h-full" step={70}>
            <SummaryTile icon={FileText} label="العقود" value={contractsCount} href={routes.accountContracts} />
            <SummaryTile icon={Wallet} label="إجمالي المدفوعات" value={null} valueText={depositsTotalText} href={routes.accountDeposits} />
            <SummaryTile icon={Wrench} label="طلبات الصيانة" value={maintenanceCount} href={routes.accountMaintenance} />
            <SummaryTile icon={Bell} label="إشعارات غير مقروءة" value={unreadCount} href={routes.accountNotifications} />
          </Stagger>

          {/* Customer recent activity, or guidance when none */}
          {hasCustomerActivity ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {recentContracts.length > 0 && (
                <Reveal className="h-full">
                  <RecentPanel icon={FileText} title="أحدث العقود" href={routes.accountContracts} className="h-full">
                    {recentContracts.map((c) => (
                      <RecentRow
                        key={c.id}
                        href={routes.accountContracts}
                        icon={FileText}
                        title={contractTitle(c)}
                        subtitle={`عقد رقم ${c.contractNumber ?? '—'}`}
                        trailing={<span className="whitespace-nowrap text-sm font-bold text-ink-strong">{formatPrice(c.totalAmount)}</span>}
                      />
                    ))}
                  </RecentPanel>
                </Reveal>
              )}

              {recentMaintenance.length > 0 && (
                <Reveal className="h-full">
                  <RecentPanel icon={Wrench} title="أحدث طلبات الصيانة" href={routes.accountMaintenance} className="h-full">
                    {recentMaintenance.map((m) => (
                      <RecentRow
                        key={m.id}
                        href={routes.accountMaintenance}
                        icon={Wrench}
                        title={m.category ? pickAr(m.category.name) || 'طلب صيانة' : 'طلب صيانة'}
                        subtitle={m.unit ? `${unitTypeLabel(m.unit.type)} · ${m.unit.code}` : undefined}
                        trailing={<StatusBadge status={m.status} />}
                      />
                    ))}
                  </RecentPanel>
                </Reveal>
              )}

              {recentNotifications.length > 0 && (
                <Reveal className="lg:col-span-2">
                  <RecentPanel icon={Bell} title="أحدث الإشعارات" href={routes.accountNotifications}>
                    {recentNotifications.map((n) => (
                      <RecentRow
                        key={n.id}
                        href={routes.accountNotifications}
                        icon={Bell}
                        title={notificationTitle(n.templateCode)}
                        subtitle={formatDateTime(n.createdAt)}
                        trailing={n.readAt === null ? <Badge tone="gold">جديد</Badge> : undefined}
                      />
                    ))}
                  </RecentPanel>
                </Reveal>
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
        </section>
      )}
    </div>
  );
}
