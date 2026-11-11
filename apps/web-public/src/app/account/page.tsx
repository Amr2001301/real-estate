import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { CalendarClock, Wrench, Bell, Heart, MessageSquareText, BookmarkCheck, FolderOpen, Phone, ArrowLeft, Upload, MapPin } from 'lucide-react';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import type { Locale } from '@/lib/locale';
import { authFetch, AuthError } from '@/lib/api-auth';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { fetchBranding } from '@/lib/branding';
import { companyContact, telHref, whatsappHref } from '@/lib/contact';
import { extractPaginatedData } from '@/lib/extract-paginated';
import { pickAr, unitTypeLabel, formatNumber, formatDateShort, formatDateTimeShort } from '@/lib/format';
import type {
  FavoriteItem,
  Paginated,
  MeVisitRequest,
  MeInfoRequest,
  MeReservation,
  MeContract,
  MeMaintenanceRequest,
  MeNotification,
  MeInstallmentsResponse,
  PublicProjectDetail,
} from '@/lib/api-types';
import { Price } from '@/components/currency/CurrencyProvider';
import { CoverImage } from '@/components/ui/CoverImage';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { DEEP_BG } from '@/components/home/Hero';
import { notificationTitle } from '@/components/account/NotificationCard';
import { extraT } from '@/messages/site-extra';

export async function generateMetadata() {
  return pageMeta('account', { robots: { index: false, follow: false } });
}

const DAY = 86_400_000;

function settled<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === 'fulfilled' ? r.value : null;
}

/** A small titled panel of the home page. */
function Panel({ title, href, linkLabel, children, className = '' }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.5rem] border border-hairline bg-surface p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-[1.15rem] font-semibold text-ink-strong">{title}</h2>
        {href && linkLabel && (
          <Link href={href as Route} className="text-[13px] font-semibold text-navy hover:underline dark:text-gold-300">{linkLabel}</Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const isCustomer = session.role === 'CUSTOMER';
  const locale: Locale = await getLocale();
  const t = extraT(locale).dash2;
  const tenant = await getResolvedTenant();

  const core = await Promise.allSettled([
    authFetch<FavoriteItem[]>('/me/favorites'),
    authFetch<Paginated<MeVisitRequest>>('/me/visit-requests?page=1&pageSize=10'),
    authFetch<Paginated<MeInfoRequest>>('/me/info-requests?page=1&pageSize=1'),
    authFetch<Paginated<MeReservation>>('/me/reservations?page=1&pageSize=3'),
    authFetch<Paginated<MeNotification> | MeNotification[]>('/me/notifications?page=1&pageSize=4', { headers: { 'Accept-Language': locale } }),
    isCustomer ? authFetch<Paginated<MeContract>>('/contracts/me/contracts?page=1&pageSize=1') : Promise.resolve(null),
    isCustomer ? authFetch<MeInstallmentsResponse>('/me/installments?page=1&pageSize=1') : Promise.resolve(null),
    isCustomer ? authFetch<Paginated<MeMaintenanceRequest>>('/me/maintenance-requests?page=1&pageSize=10') : Promise.resolve(null),
  ]);
  if (core.some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) redirect('/login');
  const [favR, visR, reqR, resR, notR, conR, insR, mntR] = core;
  const favorites = settled(favR) ?? [];
  const visits = settled(visR);
  const requests = settled(reqR);
  const reservations = settled(resR);
  const notifications = extractPaginatedData<MeNotification>(settled(notR)).slice(0, 4);
  const contract = (settled(conR) as Paginated<MeContract> | null)?.data[0] ?? null;
  const summary = (settled(insR) as MeInstallmentsResponse | null)?.summary ?? null;
  const maintenance = (settled(mntR) as Paginated<MeMaintenanceRequest> | null)?.data ?? [];

  const project = contract?.unit?.building?.phase?.project ?? null;
  const [projectRes, branding] = await Promise.all([
    project && tenant ? apiFetch<PublicProjectDetail>(`/public/projects/${project.id}`, { revalidate: 300, tenantSlug: tenant.slug }) : null,
    tenant ? fetchBranding(tenant.slug) : null,
  ]);
  const cover = projectRes?.ok ? projectRes.data.media?.find((x) => x.type === 'IMAGE' || !x.type)?.url ?? null : null;
  const place = projectRes?.ok ? projectRes.data.city : null;
  const contact = companyContact(branding);

  // The money: paid share of the contract, the next instalment and how far it is.
  const paid = Number(summary?.totalPaid ?? 0);
  const remaining = Number(summary?.remaining ?? 0);
  const total = paid + remaining;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const late = Number(summary?.late?.amount ?? summary?.overdue ?? 0);
  const lateCount = summary?.late?.count ?? summary?.counts.overdue ?? 0;
  const next = summary?.nextDue ?? null;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const nextDays = next ? Math.round((new Date(next.dueDate).getTime() - today) / DAY) : null;
  const owing = late > 0 ? { amount: late, label: t.overdue } : next ? { amount: Number(next.amount), label: t.nextDue } : null;

  // The next viewing still to come, and who the advisor is.
  const now = Date.now();
  const upcoming = (visits?.data ?? [])
    .flatMap((v) => v.appointments.filter((a) => (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && new Date(a.scheduledAt).getTime() > now).map((a) => ({ a, v })))
    .sort((x, y) => x.a.scheduledAt.localeCompare(y.a.scheduledAt))[0] ?? null;
  const advisor = upcoming?.v.assignedSales ?? visits?.data.find((v) => v.assignedSales)?.assignedSales ?? reservations?.data.find((r) => r.sales)?.sales ?? null;
  const openMaint = maintenance.filter((x) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(x.status));

  const shortcuts = [
    { href: routes.accountFavorites, label: t.favorites, count: favorites.length, icon: Heart },
    { href: routes.accountRequests, label: t.requests, count: requests?.meta.total ?? 0, icon: MessageSquareText },
    { href: routes.accountReservations, label: t.reservations, count: reservations?.meta.total ?? 0, icon: BookmarkCheck },
    ...(isCustomer ? [{ href: routes.accountDocuments, label: t.documents, count: null as number | null, icon: FolderOpen }] : []),
  ];

  return (
    <div className="space-y-6">
      {contract ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* The property and how much of it is paid */}
          <Link href={routes.accountProperty as Route} className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-hairline bg-surface sm:flex-row" data-testid="dash-property">
            <div className="relative h-48 sm:h-auto sm:w-[42%]">
              <CoverImage src={cover} alt={project ? pickAr(project.name, '', locale) : ''} className="absolute inset-0 h-full" zoomOnHover />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{t.myUnit}</p>
              <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-snug text-ink-strong">{project ? pickAr(project.name, '', locale) : contract.unit?.code}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {[contract.unit ? `${unitTypeLabel(contract.unit.type, null, locale)} · ${contract.unit.code}` : null, place].filter(Boolean).join(' — ')}
              </p>
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-ink-muted">{t.progress}</span>
                  <span className="font-display text-[1.4rem] font-semibold text-ink-strong">{formatNumber(pct, locale)}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-soft">
                  <div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
                <p className="mt-2 text-[13px] text-ink-muted">{t.paidOf(formatNumber(paid, locale), formatNumber(total, locale))}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4 text-[13px] text-ink-muted">
                <span>{t.contractNo} {contract.contractNumber ?? '—'}{contract.signedAt ? ` · ${t.signedOn} ${formatDateShort(contract.signedAt, locale)}` : ''}</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-navy dark:text-gold-300">
                  {t.viewProperty}
                  <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
                </span>
              </div>
            </div>
          </Link>

          {/* What to pay next */}
          <div className="relative flex flex-col overflow-hidden rounded-[1.5rem] p-6 text-white" style={{ background: DEEP_BG }}>
            <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
            <div className="relative flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-gold-300">{owing?.label ?? t.nextDue}</p>
              {late > 0 ? (
                <span className="rounded-full bg-red-500/90 px-3 py-1 text-xs font-semibold text-white">{t.lateCount(formatNumber(lateCount, locale))}</span>
              ) : nextDays != null ? (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">{nextDays <= 0 ? t.dueToday : t.dueIn(formatNumber(nextDays, locale))}</span>
              ) : null}
            </div>
            {owing ? (
              <>
                <p className="relative mt-3 font-display text-[2.4rem] font-semibold leading-none"><Price value={owing.amount} /></p>
                {late > 0 ? (
                  <p className="relative mt-2 text-sm text-white/70">{next ? `${t.nextOn}: ${formatDateShort(next.dueDate, locale)}` : ''}</p>
                ) : next ? (
                  <p className="relative mt-2 text-sm text-white/70">{formatDateShort(next.dueDate, locale)}</p>
                ) : null}
                <div className="relative mt-auto flex flex-col gap-2.5 pt-6">
                  <Link href={{ pathname: routes.accountDeposits, query: { submit: 'proof' } } as unknown as Route} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold-400 text-[15px] font-semibold text-[#1B1206] hover:bg-gold-300">
                    <Upload className="h-4 w-4" aria-hidden />
                    {t.payNow}
                  </Link>
                  <Link href={routes.accountInstallments as Route} className="inline-flex h-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">{t.schedule}</Link>
                </div>
              </>
            ) : (
              <p className="relative mt-4 text-white/75">{t.allPaid}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[1.5rem] p-8 text-white sm:p-10" style={{ background: DEEP_BG }}>
          <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 90% at 0% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
          <h2 className="relative font-display text-[1.8rem] font-semibold">{t.journey}</h2>
          <p className="relative mt-2 max-w-xl text-white/75">{t.journeySub}</p>
          <Link href={routes.units as Route} className="relative mt-6 inline-flex h-12 items-center rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206]">{t.browse} ←</Link>
        </div>
      )}

      {/* The money in figures */}
      {summary && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-hairline bg-hairline lg:grid-cols-4">
          {[
            { label: t.paid, value: <Price value={paid} /> },
            { label: t.remaining, value: <Price value={remaining} /> },
            { label: t.late, value: <span className={late > 0 ? 'text-red-600 dark:text-red-400' : ''}><Price value={late} /></span> },
            { label: t.paidCount, value: `${formatNumber(summary.counts.paid, locale)} / ${formatNumber(summary.counts.total, locale)}` },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-5 py-4">
              <dt className="text-[13px] text-ink-muted">{s.label}</dt>
              <dd className="mt-1 font-display text-[1.25rem] font-semibold text-ink-strong">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.visitTitle} href={routes.accountVisits} linkLabel={t.all}>
          {upcoming ? (
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700 dark:text-gold-300">
                <CalendarClock className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[1.05rem] font-semibold text-ink-strong">{formatDateTimeShort(upcoming.a.scheduledAt, locale)}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{[upcoming.v.project ? pickAr(upcoming.v.project.name, '', locale) : null, upcoming.v.unit?.code].filter(Boolean).join(' · ')}</p>
                {upcoming.a.location && <p className="mt-0.5 text-sm text-ink-muted">{upcoming.a.location}</p>}
                {upcoming.v.assignedSales && <p className="mt-1 text-[13px] font-semibold text-navy dark:text-gold-300">{t.withAdvisor(upcoming.v.assignedSales.fullName)}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-ink-muted">{t.noVisit}</p>
              <Link href={`${routes.contact}?type=visit` as Route} className="text-sm font-semibold text-navy dark:text-gold-300">{t.bookVisit} ←</Link>
            </div>
          )}
        </Panel>

        {isCustomer ? (
          <Panel title={t.maintTitle} href={routes.accountMaintenance} linkLabel={t.all}>
            {openMaint.length > 0 ? (
              <ul className="space-y-3">
                <li className="text-sm font-semibold text-ink-strong">{t.openCount(formatNumber(openMaint.length, locale))}</li>
                {openMaint.slice(0, 2).map((x) => (
                  <li key={x.id}>
                    <Link href={`${routes.accountMaintenance}/${x.id}` as Route} className="flex items-center gap-3 rounded-xl bg-surface-soft/70 px-4 py-3 hover:bg-surface-soft">
                      <Wrench className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{x.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <p className="text-ink-muted">{t.noMaint}</p>
                <Link href={routes.accountMaintenanceNew as Route} className="text-sm font-semibold text-navy dark:text-gold-300">{t.newMaint} ←</Link>
              </div>
            )}
          </Panel>
        ) : (
          <Panel title={t.shortcuts}>
            <p className="text-ink-muted">{t.journeySub}</p>
          </Panel>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={t.updates} href={routes.accountNotifications} linkLabel={t.all}>
          {notifications.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-surface-soft text-ink-muted' : 'bg-gold-400/20 text-gold-700 dark:text-gold-300'}`}>
                    <Bell className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate text-[15px] ${n.read ? 'text-ink' : 'font-semibold text-ink-strong'}`}>{notificationTitle(n.templateCode, n.title, locale === 'en' ? 'en' : 'ar')}</p>
                    {n.body && <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-ink-muted">{formatDateShort(n.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t.noUpdates}</p>
          )}
        </Panel>

        <div className="space-y-6">
          {(contact.phone || contact.whatsapp) && (
            <section className="rounded-[1.5rem] border border-hairline bg-surface p-6">
              <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{t.advisor}</p>
              <p className="mt-1 font-display text-[1.2rem] font-semibold text-ink-strong">{advisor?.fullName ?? (branding?.displayName || '')}</p>
              <p className="mt-1 text-sm text-ink-muted">{t.advisorSub}</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {contact.phone && (
                  <a href={telHref(contact.phone)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-surface-soft text-sm font-semibold text-ink-strong hover:bg-hairline/60">
                    <Phone className="h-4 w-4" aria-hidden />
                    {t.call}
                  </a>
                )}
                {contact.whatsapp && (
                  <a href={whatsappHref(contact.whatsapp)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-surface-soft text-sm font-semibold text-ink-strong hover:bg-hairline/60">
                    <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                    {t.whatsapp}
                  </a>
                )}
              </div>
            </section>
          )}
          <section className="grid grid-cols-2 gap-3">
            {shortcuts.map(({ href, label, count, icon: Icon }) => (
              <Link key={href} href={href as Route} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3.5 transition-colors hover:bg-surface-soft">
                <Icon className="h-5 w-5 shrink-0 text-gold-600" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-strong">{label}</span>
                {count != null && <span className="font-display text-sm font-semibold text-ink-muted">{formatNumber(count, locale)}</span>}
              </Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
