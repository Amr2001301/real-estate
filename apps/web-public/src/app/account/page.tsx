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
  Sparkles,
  CreditCard,
  Bell,
  ArrowLeft,
  Activity,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
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
import { JourneyTracker } from '@/components/account/JourneyTracker';
import { ContactSpecialist } from '@/components/account/ContactSpecialist';

export const metadata = buildMetadata({
  title: 'لوحة الحساب',
  description: 'منطقة العميل في ديفورا.',
  robots: { index: false, follow: false },
});

// ── Constants ─────────────────────────────────────────────────────────────────

const GLOW = {
  background: 'radial-gradient(circle at 80% 10%, rgba(200,162,75,0.12), transparent 55%)',
} as const;

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return '—';
  }
}

function entityTitle(
  project: VisitProjectRef | null,
  unit: VisitUnitRef | null,
  fallback: string,
): string {
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

// ── KPI Metric Tile ───────────────────────────────────────────────────────────

interface MetricTile {
  icon:      LucideIcon;
  label:     string;
  value:     string;
  currency?: string;
  hint:      string;
  href:      string;
}

function HeroMetric({ icon: Icon, label, value, currency, hint, href }: MetricTile) {
  return (
    <Link
      href={href as Route}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-200 hover:shadow-[0_0_0_2px_rgba(200,162,75,0.10),0_12px_32px_-8px_rgba(15,30,51,0.18)]"
    >
      {/* Thin gold accent bar — same language as InquiryCard / ProjectFacts */}
      <div
        className="h-0.5 w-full"
        style={{ background: 'linear-gradient(to left, transparent, rgba(200,162,75,0.55), transparent)' }}
        aria-hidden
      />

      <div className="flex flex-col gap-4 p-5">
        {/* Top row: label + hint on the right (RTL start), icon on the left (RTL end) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-bold leading-snug text-ink-strong">{label}</div>
            <div className="mt-0.5 text-[11px] font-medium text-ink-muted/65">{hint}</div>
          </div>
          {/* Unified gold icon tile — same treatment as UnitSpecs / ProjectFacts */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-50 to-white shadow-[0_1px_4px_-1px_rgba(200,162,75,0.18)] ring-1 ring-gold-100/80 transition-all duration-300 group-hover:from-gold-100 group-hover:ring-gold-200/80">
            <Icon className="h-[18px] w-[18px] text-gold-600" aria-hidden />
          </span>
        </div>

        {/* Value — the primary payload, reads large and immediate */}
        {currency ? (
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" dir="rtl">
            <span className="font-display text-[1.75rem] font-black leading-none tracking-tight text-ink-strong">
              {value}
            </span>
            <span className="text-[0.8rem] font-bold text-ink-muted/55">{currency}</span>
          </span>
        ) : (
          <div className="font-display text-[2rem] font-black leading-none tracking-tight text-ink-strong">
            {value}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function DashSection({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon?:     LucideIcon;
  title:     string;
  action?:   React.ReactNode;
  children:  React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600 ring-1 ring-gold-200/60">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-widest text-ink-muted">
          {title}
        </span>
        <div className="flex-1 h-px bg-hairline/70" />
        {action}
      </div>
      {children}
    </section>
  );
}

// ── Quick Action Tile ─────────────────────────────────────────────────────────

function QuickActionTile({
  href,
  icon: Icon,
  label,
  description,
}: {
  href:        string;
  icon:        LucideIcon;
  label:       string;
  description: string;
}) {
  return (
    <Link
      href={href as Route}
      className="group flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-4 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-gold-300/60 hover:shadow-card hover:ring-1 hover:ring-gold-200/50"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/60 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink-strong leading-tight">{label}</p>
        <p className="mt-0.5 text-[11px] text-ink-muted leading-tight">{description}</p>
      </div>
      <ArrowLeft
        className="h-4 w-4 shrink-0 -translate-x-1 text-gold-500 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

// ── Timeline (notification / visit feed) ──────────────────────────────────────

function TimelinePanel({
  title,
  href,
  viewAllLabel,
  children,
}: {
  title:        string;
  href:         string;
  viewAllLabel: string;
  children:     React.ReactNode;
}) {
  return (
    <PremiumCard className="p-5">
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <h2 className="truncate text-base font-bold text-ink-strong">{title}</h2>
        <Link
          href={href as Route}
          className="inline-flex shrink-0 items-center rounded-lg border border-hairline/70 bg-surface-soft px-3 py-1 text-[10px] font-extrabold text-ink-strong shadow-sm transition-all duration-200 hover:bg-hairline/40"
        >
          {viewAllLabel}
        </Link>
      </div>
      <div className="space-y-4 border-s-2 border-gold-200/60 ps-4">{children}</div>
    </PremiumCard>
  );
}

function TimelineItem({
  title,
  subtitle,
  trailing,
}: {
  title:     string;
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const isCustomer = session.role === 'CUSTOMER';

  const locale = await getLocale();
  const m = siteT(locale).accountPages.dashboard;

  // ── Data fetching — unchanged ─────────────────────────────────────────────
  const [favsR, visitsR, reqsR, resvR] = await Promise.allSettled([
    authFetch<FavoriteItem[]>('/me/favorites'),
    authFetch<Paginated<MeVisitRequest>>('/me/visit-requests?page=1&pageSize=3'),
    authFetch<Paginated<MeInfoRequest>>('/me/info-requests?page=1&pageSize=3'),
    authFetch<Paginated<MeReservation>>('/me/reservations?page=1&pageSize=3'),
  ]);
  if (
    [favsR, visitsR, reqsR, resvR].some(
      (r) => r.status === 'rejected' && r.reason instanceof AuthError,
    )
  ) {
    redirect('/login');
  }

  const favorites   = favsR.status  === 'fulfilled' ? favsR.value   : null;
  const visits      = visitsR.status === 'fulfilled' ? visitsR.value  : null;
  const requests    = reqsR.status   === 'fulfilled' ? reqsR.value    : null;
  const reservations = resvR.status  === 'fulfilled' ? resvR.value   : null;

  const favoritesCount    = favorites    ? favorites.length            : null;
  const visitsCount       = visits       ? visits.meta.total           : null;
  const requestsCount     = requests     ? requests.meta.total         : null;
  const reservationsCount = reservations ? reservations.meta.total     : null;

  const recentVisits       = visits?.data       ?? [];
  const recentReservations = reservations?.data ?? [];

  // ── Customer-only data ────────────────────────────────────────────────────
  let contractsCount:      number | null = null;
  let depositsTotalText:   string | null = null;
  let depositsAmountText:  string | null = null;
  let maintenanceCount:    number | null = null;
  let recentContracts:    MeContract[]     = [];
  let recentNotifications: MeNotification[] = [];
  let primaryContract:    MeContract | null = null;
  let nextInstallment:    MeInstallment | null = null;
  let unpaidCount = 0;

  if (isCustomer) {
    const [contractsR, depositsR, maintR, notifsR, instR] = await Promise.allSettled([
      authFetch<Paginated<MeContract>>('/contracts/me/contracts?page=1&pageSize=3'),
      authFetch<MeDepositsResponse>('/me/deposits'),
      authFetch<Paginated<MeMaintenanceRequest>>('/me/maintenance-requests?page=1&pageSize=3'),
      authFetch<Paginated<MeNotification> | MeNotification[]>('/me/notifications'),
      authFetch<Paginated<MeInstallment>>('/me/installments?page=1&pageSize=200'),
    ]);
    if (
      [contractsR, depositsR, maintR, notifsR, instR].some(
        (r) => r.status === 'rejected' && r.reason instanceof AuthError,
      )
    ) {
      redirect('/login');
    }

    const contracts    = contractsR.status === 'fulfilled' ? contractsR.value : null;
    const deposits     = depositsR.status  === 'fulfilled' ? depositsR.value  : null;
    const maintenance  = maintR.status     === 'fulfilled' ? maintR.value     : null;
    const installments = instR.status      === 'fulfilled' ? instR.value.data : [];

    const unpaid = installments.filter((i) => i.status !== 'PAID');
    unpaidCount  = unpaid.length;
    nextInstallment =
      unpaid.length > 0
        ? unpaid.reduce((earliest, i) => (i.dueDate < earliest.dueDate ? i : earliest))
        : null;

    const notificationsRaw = notifsR.status === 'fulfilled' ? notifsR.value : null;
    const notifications    = extractPaginatedData<MeNotification>(notificationsRaw);

    contractsCount     = contracts   ? contracts.meta.total                    : null;
    depositsTotalText  = deposits    ? formatPrice(deposits.totals.totalAmount) : null;
    depositsAmountText = deposits    ? formatNumber(deposits.totals.totalAmount): null;
    maintenanceCount   = maintenance ? maintenance.meta.total                   : null;

    recentContracts      = contracts?.data ?? [];
    recentNotifications  = notifications.slice(0, 3);
    primaryContract      = recentContracts[0] ?? null;
  }

  const fmt = (n: number | null) => (n != null ? formatNumber(n) : '—');
  const sum = (...vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v != null);
    return present.length ? formatNumber(present.reduce((a, b) => a + b, 0)) : '—';
  };

  // ── KPI Tiles ─────────────────────────────────────────────────────────────
  const tiles: MetricTile[] = isCustomer
    ? [
        {
          icon:     Wallet,
          label:    m.totalPayments,
          value:    depositsAmountText ?? '—',
          currency: depositsAmountText ? m.currency || undefined : undefined,
          hint:     m.totalCollected,
          href:     routes.accountDeposits,
        },
        {
          icon:  FileText,
          label: m.activeContracts,
          value: fmt(contractsCount),
          hint:  m.verifiedContracts,
          href:  routes.accountContracts,
        },
        {
          icon:  Wrench,
          label: m.maintenanceVisits,
          value: sum(maintenanceCount, visitsCount),
          hint:  m.inProgress,
          href:  routes.accountMaintenance,
        },
        {
          icon:  Heart,
          label: m.favorites,
          value: fmt(favoritesCount),
          hint:  m.savedItems,
          href:  routes.accountFavorites,
        },
      ]
    : [
        {
          icon:  Heart,
          label: m.favorites,
          value: fmt(favoritesCount),
          hint:  m.savedItems,
          href:  routes.accountFavorites,
        },
        {
          icon:  CalendarClock,
          label: m.visitRequests,
          value: fmt(visitsCount),
          hint:  m.scheduled,
          href:  routes.accountVisits,
        },
        {
          icon:  MessageSquareText,
          label: m.inquiries,
          value: fmt(requestsCount),
          hint:  m.processing,
          href:  routes.accountRequests,
        },
        {
          icon:  BookmarkCheck,
          label: m.reservations,
          value: fmt(reservationsCount),
          hint:  m.active,
          href:  routes.accountReservations,
        },
      ];

  // ── Activity rows ─────────────────────────────────────────────────────────
  const rightRows = [
    ...recentContracts.map((c) => (
      <RecentRow
        key={`c-${c.id}`}
        href={routes.accountContracts}
        icon={FileText}
        title={contractTitle(c)}
        subtitle={`${m.contractPrefix} ${c.contractNumber ?? '—'}`}
        trailing={
          <span className="whitespace-nowrap text-sm font-bold text-ink-strong">
            {formatPrice(c.totalAmount)}
          </span>
        }
      />
    )),
    ...recentReservations.map((r) => (
      <RecentRow
        key={`r-${r.id}`}
        href={routes.accountReservations}
        icon={BookmarkCheck}
        title={`${m.reservationPrefix} ${r.reservationNumber ?? '—'}`}
        subtitle={r.unit ? `${unitTypeLabel(r.unit.type)} · ${r.unit.code}` : undefined}
        trailing={<StatusBadge status={r.status} />}
      />
    )),
  ].slice(0, 3);

  const leftItems = [
    ...recentNotifications.map((n) => (
      <TimelineItem
        key={`n-${n.id}`}
        title={notificationTitle(n.templateCode)}
        subtitle={formatDateTime(n.createdAt)}
        trailing={!n.read ? <Badge tone="gold">{m.newBadge}</Badge> : undefined}
      />
    )),
    ...recentVisits.map((v) => (
      <TimelineItem
        key={`v-${v.id}`}
        title={entityTitle(v.project, v.unit, m.visitLabel)}
        subtitle={`${m.preferredDate} ${formatDateTime(v.preferredDate)}`}
        trailing={<StatusBadge status={v.requestStatus} />}
      />
    )),
  ].slice(0, 3);

  const rightTitle = isCustomer ? m.recentBookings : m.recentReservations;
  const rightIcon  = isCustomer ? FileText : BookmarkCheck;
  const rightHref  = isCustomer ? routes.accountContracts : routes.accountReservations;
  const leftTitle  = isCustomer ? m.notificationsVisits : m.recentVisits;
  const leftHref   = isCustomer ? routes.accountNotifications : routes.accountVisits;
  const hasActivity = rightRows.length > 0 || leftItems.length > 0;

  return (
    <div className="space-y-8">

      {/* ── KPI Tiles ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <HeroMetric key={t.label} {...t} />
        ))}
      </div>

      {/* ── Customer: Quick Actions ────────────────────────────────────────── */}
      {isCustomer && (
        <DashSection icon={Zap} title={m.quickActions}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickActionTile
              href={routes.accountProperty}
              icon={Building2}
              label={m.myProperty}
              description={m.propertyDetails}
            />
            <QuickActionTile
              href={routes.accountInstallments}
              icon={CreditCard}
              label={m.installmentSchedule}
              description={unpaidCount > 0 ? `${formatNumber(unpaidCount)} ${m.installmentDue}` : m.viewInstallments}
            />
            <QuickActionTile
              href={routes.accountMaintenanceNew}
              icon={Wrench}
              label={m.maintenance}
              description={m.maintenanceSub}
            />
            <QuickActionTile
              href={routes.accountContracts}
              icon={FileText}
              label={m.myContracts}
              description={m.viewContracts}
            />
            <QuickActionTile
              href={routes.accountDeposits}
              icon={Wallet}
              label={m.paymentHistory}
              description={depositsTotalText ? `${m.total} ${depositsTotalText}` : m.viewPayments}
            />
            <QuickActionTile
              href={routes.accountNotifications}
              icon={Bell}
              label={m.notifications}
              description={m.notificationsSub}
            />
          </div>
        </DashSection>
      )}

      {/* ── Journey tracker + Contact specialist (side-by-side on lg) ─────── */}
      {isCustomer && (recentReservations.length > 0 || recentContracts.length > 0) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <JourneyTracker reservations={recentReservations} contracts={recentContracts} />
          <ContactSpecialist reservations={recentReservations} visits={recentVisits} />
        </div>
      )}
      {!isCustomer && recentVisits.length > 0 && (
        <ContactSpecialist reservations={recentReservations} visits={recentVisits} />
      )}

      {/* ── Customer: After-Sales (PropertyFocus) ─────────────────────────── */}
      {isCustomer && primaryContract && (
        <DashSection
          icon={Sparkles}
          title={m.ownershipArea}
          action={
            <div className="flex items-center gap-2">
              <ButtonLink
                href={routes.accountProperty}
                variant="primary"
                size="sm"
                className="h-auto rounded-xl px-4 py-1.5 text-xs font-bold shadow-sm"
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {m.myProperty}
              </ButtonLink>
              <ButtonLink
                href={routes.accountMaintenanceNew}
                variant="gold"
                size="sm"
                className="h-auto rounded-xl px-4 py-1.5 text-xs font-bold shadow-sm"
              >
                <Wrench className="h-3.5 w-3.5" aria-hidden />
                {m.maintenanceArea}
              </ButtonLink>
            </div>
          }
        >
          <PropertyFocus
            contract={primaryContract}
            nextInstallment={nextInstallment}
            unpaidCount={unpaidCount}
          />
        </DashSection>
      )}

      {/* ── Activity center ────────────────────────────────────────────────── */}
      {hasActivity ? (
        <DashSection icon={Activity} title={m.recentActivity}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {rightRows.length > 0 && (
              <RecentPanel icon={rightIcon} title={rightTitle} href={rightHref}>
                {rightRows}
              </RecentPanel>
            )}
            {leftItems.length > 0 && (
              <TimelinePanel title={leftTitle} href={leftHref} viewAllLabel={m.viewAll}>
                {leftItems}
              </TimelinePanel>
            )}
          </div>
        </DashSection>
      ) : (
        !isCustomer && (
          <DashSection icon={UserCircle2} title={m.startJourney}>
            <PremiumCard className="px-8 py-12 text-center">
              {/* Decorative glow */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-gold-50/60 to-transparent" aria-hidden />
              <div className="relative flex flex-col items-center gap-5">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 shadow-sm">
                  <UserCircle2 className="h-8 w-8" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-black text-ink-strong">{m.startJourneyTitle}</h3>
                  <p className="mt-2 text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
                    {m.startJourneyMsg}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  <ButtonLink href={routes.projects} variant="primary" size="md">
                    {m.browseProjects}
                  </ButtonLink>
                  <ButtonLink href={routes.units} variant="outline" size="md">
                    {m.exploreUnits}
                  </ButtonLink>
                </div>
              </div>
            </PremiumCard>
          </DashSection>
        )
      )}

    </div>
  );
}
