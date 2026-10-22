import Link from 'next/link';
import {
  Plus,
  CalendarClock,
  Phone,
  Clock,
  AlertCircle,
  Building2,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalVisitRequest } from '@/lib/types';
import { tx, formatDate, formatTime, intlLocale, DEFAULT_TIME_ZONE } from '@/lib/format';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { cn } from '@/lib/cn';
import { getLocale, type Locale } from '@/lib/locale';
import { portalLeadsVisitsT } from '@/messages/portal/leads-visits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
} from '@/components/premium';
import { EntityLink } from '@/components/entity-link';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  requestStatus?: string;
  q?: string;
}

const PAGE_SIZE = 20;

function appointmentUrgency(
  iso: string | null | undefined,
  labels: { today: string; tomorrow: string; past: string },
): { key: 'today' | 'tomorrow' | 'past'; label: string; className: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const tom = new Date(now);
  tom.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString())
    return { key: 'today', label: labels.today, className: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (d.toDateString() === tom.toDateString())
    return { key: 'tomorrow', label: labels.tomorrow, className: 'bg-blue-50 text-blue-700 border border-blue-100' };
  if (d < now)
    return { key: 'past', label: labels.past, className: 'bg-slate-100 text-slate-500 border border-slate-200' };
  return null;
}

export default async function PortalVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalLeadsVisitsT(locale);
  const t = m.visits.list;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.requestStatus) qs.set('requestStatus', sp.requestStatus);
  if (sp.q) qs.set('q', sp.q);

  const [r, rAll, rNew, rUnderReview, rConverted, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalVisitRequest>>(`/portal/visits?${qs.toString()}`)),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=NEW')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=UNDER_REVIEW')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=CONVERTED')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=REJECTED')),
  ]);

  const paged        = r.data;
  const rows         = paged?.data ?? [];
  const totalCount     = rAll.data?.meta.total ?? paged?.meta.total ?? 0;
  const pendingCount   = (rNew.data?.meta.total ?? 0) + (rUnderReview.data?.meta.total ?? 0);
  const scheduledCount = rConverted.data?.meta.total ?? 0;
  const rejectedCount  = rRejected.data?.meta.total  ?? 0;

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.breadcrumbs.portal, href: '/portal' },
          { label: m.breadcrumbs.visits },
        ]}
        actions={
          <Link href="/portal/visits/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {t.newRequest}
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadErrorPrefix} {r.error}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: totalCount, href: '/portal/visits' },
            { label: t.metrics.pending, value: pendingCount, href: '/portal/visits?requestStatus=NEW', warn: pendingCount > 0 },
            { label: t.metrics.scheduled, value: scheduledCount, href: '/portal/visits?requestStatus=CONVERTED' },
            { label: t.metrics.rejected, value: rejectedCount, href: '/portal/visits?requestStatus=REJECTED' },
          ]}
        />
      </section>

      <PremiumFilterBar
        method="get"
        action="/portal/visits"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">{t.filter}</Button>
            {(sp.requestStatus || sp.q) && (
              <Link href="/portal/visits">
                <Button type="button" variant="ghost" size="sm">{t.clearFilter}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={t.searchLabel}>
          <Input
            inputSize="sm"
            name="q"
            leftAddon={<Search />}
            placeholder={t.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="flex-1 min-w-[180px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label={t.statusLabel}>
          <Select
            name="requestStatus"
            inputSize="sm"
            defaultValue={sp.requestStatus ?? ''}
            className="w-52"
          >
            <option value="">{t.statusOptions.all}</option>
            <option value="NEW">{t.statusOptions.NEW}</option>
            <option value="UNDER_REVIEW">{t.statusOptions.UNDER_REVIEW}</option>
            <option value="CONVERTED">{t.statusOptions.CONVERTED}</option>
            <option value="REJECTED">{t.statusOptions.REJECTED}</option>
            <option value="CANCELLED">{t.statusOptions.CANCELLED}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        icon={<CalendarClock />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>{t.countNoun}</span>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Link href="/portal/visits/new">
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  {t.newRequest}
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-visit-rows">
            {rows.map((v) => {
              const clientName  = v.lead?.fullName ?? v.customerName;
              const clientPhone = v.lead?.phone ?? v.customerPhone;
              const appt        = v.appointments?.[0];
              const urgency     = appointmentUrgency(appt?.scheduledAt, t.urgency);
              const isToday     = urgency?.key === 'today';

              return (
                <li
                  key={v.id}
                  data-testid="portal-visit-row"
                  className={cn(
                    'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors lg:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_170px]',
                    isToday ? 'bg-amber-500/[0.06] hover:bg-amber-500/10' : 'hover:bg-surface-muted/30',
                  )}
                >
                  {/* The appointment once booked, else the preferred day (date-only, UTC). */}
                  {appt ? (
                    <DateTile value={appt.scheduledAt} time={formatTime(appt.scheduledAt, locale)} timeZone={DEFAULT_TIME_ZONE} locale={locale} />
                  ) : (
                    <DateTile value={v.preferredDate} timeZone="UTC" locale={locale} />
                  )}

                  {/* Client */}
                  <div className="flex min-w-0 items-center gap-3">
                    {clientName && <Avatar name={clientName} />}
                    <div className="min-w-0">
                      <p className={cn('truncate text-[14.5px] font-bold', clientName ? 'text-slate-900' : 'text-slate-400')}>
                        {v.lead ? (
                          <EntityLink kind="lead" id={v.lead.id} scope="portal" mono={false}>{clientName}</EntityLink>
                        ) : (clientName ?? '—')}
                      </p>
                      {clientPhone && (
                        <a href={`tel:${clientPhone}`} className="mt-1 inline-flex items-center gap-1 text-[12px] tabular-nums text-slate-500 hover:text-brand-700">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{clientPhone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Project + unit */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{v.project ? tx(v.project.name, locale) : '—'}</p>
                      {v.unit?.code && (
                        <p className="mt-0.5 text-slate-500">
                          <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span>
                          <span className="whitespace-nowrap font-mono" dir="ltr">{v.unit.code}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Appointment */}
                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    {appt ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {urgency && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', URGENCY_CHIP[urgency.key])}>
                            {urgency.label}
                          </span>
                        )}
                        <AppointmentStatusBadge status={appt.status} locale={locale} />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        {t.awaitingScheduling}
                      </span>
                    )}
                    <p className="mt-1 whitespace-nowrap text-[11.5px] text-slate-500">
                      {t.cols.preferredDate}: <bdi>{formatDate(v.preferredDate, locale, 'UTC')}</bdi>
                    </p>
                  </div>

                  {/* Request status */}
                  <div className="hidden lg:block">
                    {v.requestStatus ? <VisitRequestStatusBadge status={v.requestStatus} locale={locale} /> : <span className="text-slate-400">—</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/visits"
            locale={locale}
            params={{ requestStatus: sp.requestStatus, q: sp.q }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}

const URGENCY_CHIP: Record<'today' | 'tomorrow' | 'past', string> = {
  today: 'bg-amber-500/15 text-amber-600',
  tomorrow: 'bg-sky-500/12 text-sky-600',
  past: 'bg-slate-500/12 text-slate-500',
};

/** A small calendar leaf: weekday, day number, month; the time beneath. */
function DateTile({
  value,
  time,
  timeZone,
  locale,
}: {
  value: string | null | undefined;
  time?: string | null;
  timeZone: string;
  locale: Locale;
}) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return <div className="h-[68px] w-16 rounded-2xl border border-dashed border-hairline" />;
  }
  const loc = intlLocale(locale);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { ...o, timeZone }).format(d);
  return (
    <div className="flex w-16 flex-col items-center overflow-hidden rounded-2xl border border-hairline bg-surface-muted/40 text-center">
      <span className="w-full bg-[#C9A24E]/12 py-0.5 text-[10.5px] font-bold text-brand-700">{part({ weekday: 'short' })}</span>
      <span className="pt-1 text-[22px] font-bold leading-none tabular-nums text-slate-900">{part({ day: 'numeric' })}</span>
      <span className="pb-1 text-[11px] font-semibold text-slate-500">{part({ month: 'short' })}</span>
      {time && (
        <span dir="ltr" className="w-full border-t border-hairline py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-600">
          {time}
        </span>
      )}
    </div>
  );
}
