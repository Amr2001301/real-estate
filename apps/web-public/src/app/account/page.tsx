import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Heart,
  CalendarClock,
  MessageSquareText,
  BookmarkCheck,
  Building2,
  UserCircle2,
  FileText,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { authFetch, AuthError } from '@/lib/api-auth';
import { extractPaginatedData } from '@/lib/extract-paginated';
import { pickAr, unitTypeLabel, formatPrice, formatNumber } from '@/lib/format';
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
import { PremiumCard } from '@/components/ui/PremiumCard';
import { EmptyState } from '@/components/states/EmptyState';
import { PropertyFocus } from '@/components/account/PropertyFocus';
import { RecentRow } from '@/components/account/RecentRow';
import { RecentPanel } from '@/components/account/RecentPanel';
import { StatusBadge } from '@/components/account/StatusBadge';
import { notificationTitle } from '@/components/account/NotificationCard';

// Tinted icon chips for the hero metrics — theme tokens, dark-mode safe.
const CHIP_SUCCESS = 'bg-success/10 text-success ring-1 ring-success/20';
const CHIP_GOLD = 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70';
const CHIP_AMBER = 'bg-warning/10 text-warning ring-1 ring-warning/20';
const CHIP_ROSE = 'bg-error/10 text-error ring-1 ring-error/20';

interface Metric {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
  chip: string;
}

/** Compact executive metric card: tinted icon + label/value stack. */
function HeroMetric({ icon: Icon, label, value, href, chip }: Metric) {
  return (
    <Link
      href={href as Route}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-5 py-4 shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-ink-muted">{label}</div>
        <div className="mt-0.5 truncate text-base font-black text-ink-strong" dir="auto">
          {value}
        </div>
      </div>
      <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', chip)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}

/** Left activity panel with a vertical timeline rail (RTL start edge). */
function TimelinePanel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <PremiumCard className="p-5">
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <h2 className="truncate text-base font-bold text-ink-strong">{title}</h2>
        <Link
          href={href as Route}
          className="inline-flex shrink-0 items-center rounded-lg border border-hairline/70 bg-surface-soft px-3 py-1 text-[10px] font-extrabold text-ink-strong shadow-sm transition-all duration-200 hover:bg-hairline/40"
        >
          عرض الكل
        </Link>
      </div>
      <div className="space-y-4 border-s-2 border-hairline/70 ps-4">{children}</div>
    </PremiumCard>
  );
}

function TimelineItem({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span
        className="absolute -start-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-gold-400 ring-2 ring-surface"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-semibold text-ink-strong">{title}</p>
          {subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </div>
  );
}

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
  const recentReservations = reservations?.data ?? [];

  // ── Customer sources (CUSTOMER only — CLIENT never calls these) ──────────
  let contractsCount: number | null = null;
  let depositsTotalText: string | null = null;
  let maintenanceCount: number | null = null;
  let recentContracts: MeContract[] = [];
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

    contractsCount = contracts ? contracts.meta.total : null;
    depositsTotalText = deposits ? formatPrice(deposits.totals.totalAmount) : null;
    maintenanceCount = maintenance ? maintenance.meta.total : null;

    recentContracts = contracts?.data ?? [];
    recentNotifications = notifications.slice(0, 3);
    primaryContract = recentContracts[0] ?? null;
  }

  const fmt = (n: number | null) => (n != null ? formatNumber(n) : '—');
  const sum = (...vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v != null);
    return present.length ? formatNumber(present.reduce((a, b) => a + b, 0)) : '—';
  };

  // ── Block 1: role-aware hero metrics ──
  const metrics: Metric[] = isCustomer
    ? [
        { icon: Wallet, label: 'إجمالي المدفوعات', value: depositsTotalText ?? '—', href: routes.accountDeposits, chip: CHIP_SUCCESS },
        { icon: FileText, label: 'العقود النشطة', value: fmt(contractsCount), href: routes.accountContracts, chip: CHIP_GOLD },
        { icon: Wrench, label: 'طلبات الصيانة والزيارات', value: sum(maintenanceCount, visitsCount), href: routes.accountMaintenance, chip: CHIP_AMBER },
        { icon: Heart, label: 'المفضلة', value: fmt(favoritesCount), href: routes.accountFavorites, chip: CHIP_ROSE },
      ]
    : [
        { icon: Heart, label: 'المفضلة', value: fmt(favoritesCount), href: routes.accountFavorites, chip: CHIP_ROSE },
        { icon: CalendarClock, label: 'طلبات الزيارة', value: fmt(visitsCount), href: routes.accountVisits, chip: CHIP_GOLD },
        { icon: MessageSquareText, label: 'الاستفسارات', value: fmt(requestsCount), href: routes.accountRequests, chip: CHIP_AMBER },
        { icon: BookmarkCheck, label: 'الحجوزات', value: fmt(reservationsCount), href: routes.accountReservations, chip: CHIP_SUCCESS },
      ];

  // ── Block 3: activity center ──
  // Right — bookings + contracts (latest 2).
  const rightRows = [
    ...recentContracts.map((c) => (
      <RecentRow
        key={`c-${c.id}`}
        href={routes.accountContracts}
        icon={FileText}
        title={contractTitle(c)}
        subtitle={`عقد رقم ${c.contractNumber ?? '—'}`}
        trailing={<span className="whitespace-nowrap text-sm font-bold text-ink-strong">{formatPrice(c.totalAmount)}</span>}
      />
    )),
    ...recentReservations.map((r) => (
      <RecentRow
        key={`r-${r.id}`}
        href={routes.accountReservations}
        icon={BookmarkCheck}
        title={`حجز رقم ${r.reservationNumber ?? '—'}`}
        subtitle={r.unit ? `${unitTypeLabel(r.unit.type)} · ${r.unit.code}` : undefined}
        trailing={<StatusBadge status={r.status} />}
      />
    )),
  ].slice(0, 2);

  // Left — notifications + visits (latest 3), shown on a timeline rail.
  const leftItems = [
    ...recentNotifications.map((n) => (
      <TimelineItem
        key={`n-${n.id}`}
        title={notificationTitle(n.templateCode)}
        subtitle={formatDateTime(n.createdAt)}
        trailing={!n.read ? <Badge tone="gold">جديد</Badge> : undefined}
      />
    )),
    ...recentVisits.map((v) => (
      <TimelineItem
        key={`v-${v.id}`}
        title={entityTitle(v.project, v.unit, 'طلب زيارة')}
        subtitle={`الموعد المفضل: ${formatDateTime(v.preferredDate)}`}
        trailing={<StatusBadge status={v.requestStatus} />}
      />
    )),
  ].slice(0, 3);

  const rightTitle = isCustomer ? 'أحدث الحجوزات والعقود' : 'أحدث الحجوزات';
  const rightIcon = isCustomer ? FileText : BookmarkCheck;
  const rightHref = isCustomer ? routes.accountContracts : routes.accountReservations;
  const leftTitle = isCustomer ? 'الإشعارات والزيارات' : 'أحدث الزيارات';
  const leftHref = isCustomer ? routes.accountNotifications : routes.accountVisits;
  const hasActivity = rightRows.length > 0 || leftItems.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Block 1: unified hero metrics ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <HeroMetric key={m.label} {...m} />
        ))}
      </div>

      {/* ── Block 2: after-sales banner (customer + owned unit) ── */}
      {isCustomer && primaryContract && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-ink-strong">خدمات ما بعد الشراء</h2>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink
                href={routes.accountProperty}
                variant="primary"
                size="sm"
                className="h-auto rounded-xl px-4 py-2 text-xs font-bold shadow-sm"
              >
                <Building2 className="h-4 w-4" aria-hidden />
                عقاراتي
              </ButtonLink>
              <ButtonLink
                href={routes.accountMaintenanceNew}
                variant="gold"
                size="sm"
                className="h-auto rounded-xl px-4 py-2 text-xs font-bold shadow-sm"
              >
                <Wrench className="h-4 w-4" aria-hidden />
                طلب صيانة جديد
              </ButtonLink>
            </div>
          </div>
          <PropertyFocus contract={primaryContract} nextInstallment={nextInstallment} unpaidCount={unpaidCount} />
        </section>
      )}

      {/* ── Block 3: micro recent-activity center ── */}
      {hasActivity ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {rightRows.length > 0 && (
            <RecentPanel icon={rightIcon} title={rightTitle} href={rightHref}>
              {rightRows}
            </RecentPanel>
          )}
          {leftItems.length > 0 && (
            <TimelinePanel title={leftTitle} href={leftHref}>
              {leftItems}
            </TimelinePanel>
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
    </div>
  );
}
