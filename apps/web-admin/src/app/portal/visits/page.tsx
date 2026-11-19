import Link from 'next/link';
import {
  Plus,
  CalendarClock,
  Clock,
  AlertCircle,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalVisitRequest } from '@/lib/types';
import { tx, formatDate, formatTime, intlLocale, DEFAULT_TIME_ZONE } from '@/lib/format';
import { FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { DataTable, ListFilterBar, ListFilterField, ListPage, ListPager, ListTableCard, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
import { cn } from '@/lib/cn';
import { getLocale, type Locale } from '@/lib/locale';
import { portalLeadsVisitsT } from '@/messages/portal/leads-visits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  requestStatus?: string;
  q?: string;
}

const PAGE_SIZE = 10;

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
  // OPEN is the «قيد الانتظار» figure: new or under review.
  if (sp.requestStatus === 'OPEN') qs.set('open', 'true');
  else if (sp.requestStatus) qs.set('requestStatus', sp.requestStatus);
  if (sp.q) qs.set('q', sp.q);

  const [r, rAll, rOpen, rConverted, rRejected, projectsRes] = await Promise.all([
    safe(api.get<Paged<PortalVisitRequest>>(`/portal/visits?${qs.toString()}`)),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&open=true')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=CONVERTED')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=REJECTED')),
    safe(api.get<PortalProject[]>('/portal/projects')),
  ]);
  const covers = new Map((projectsRes.data ?? []).map((p) => [p.project.id, p.project.media?.[0]?.url]));

  const paged        = r.data;
  const rows         = paged?.data ?? [];
  const totalCount     = rAll.data?.meta.total ?? paged?.meta.total ?? 0;
  const pendingCount   = rOpen.data?.meta.total ?? 0;
  const scheduledCount = rConverted.data?.meta.total ?? 0;
  const rejectedCount  = rRejected.data?.meta.total  ?? 0;

  // A figure is on when the list shows exactly what it counts (no search);
  // clicking it again goes back to the whole list.
  const figLink = (status: string | undefined) => {
    const active = !sp.q && (sp.requestStatus || undefined) === status;
    return { active, href: active || !status ? '/portal/visits' : `/portal/visits?requestStatus=${status}` };
  };

  return (
    <ListPage minHeight={960}>

      <PremiumPageHero
        className="shrink-0"
        eyebrow={<span className="inline-flex items-center gap-2">{locale === 'ar' ? 'بوابة الوسيط / الزيارات' : 'Broker portal / Visits'}<span aria-hidden className="h-px w-6 bg-brand-700/40" /></span>}
        title={t.title}
        description={t.description}
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

      <section className="shrink-0">
        <FigureBar
          variant="cards"
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: totalCount, ...figLink(undefined), icon: FigIcons.total },
            { label: t.metrics.pending, value: pendingCount, ...figLink('OPEN'), warn: pendingCount > 0, icon: FigIcons.pending },
            { label: t.metrics.scheduled, value: scheduledCount, ...figLink('CONVERTED'), icon: FigIcons.calendar, tone: 'green' },
            { label: t.metrics.rejected, value: rejectedCount, ...figLink('REJECTED'), icon: FigIcons.rejected, tone: 'red' },
          ]}
        />
      </section>

      <ListFilterBar
        action="/portal/visits"
        submitLabel={t.filter}
        clearHref={sp.requestStatus || sp.q ? '/portal/visits' : undefined}
        clearLabel={t.clearFilter}
      >
        <ListFilterField search label={t.searchLabel}>
          <Input name="q" inputSize="sm" placeholder={t.searchPlaceholder} defaultValue={sp.q ?? ''} />
        </ListFilterField>
        <ListFilterField label={t.statusLabel}>
          <Select name="requestStatus" inputSize="sm" defaultValue={sp.requestStatus ?? ''}>
            <option value="">{t.statusOptions.all}</option>
            <option value="OPEN">{t.metrics.pending}</option>
            <option value="NEW">{t.statusOptions.NEW}</option>
            <option value="UNDER_REVIEW">{t.statusOptions.UNDER_REVIEW}</option>
            <option value="CONVERTED">{t.statusOptions.CONVERTED}</option>
            <option value="REJECTED">{t.statusOptions.REJECTED}</option>
            <option value="CANCELLED">{t.statusOptions.CANCELLED}</option>
          </Select>
        </ListFilterField>
      </ListFilterBar>

      <ListTableCard
        title={locale === 'ar' ? 'طلبات الزيارة' : 'Visit requests'}
        footer={paged && paged.meta.total > 0 ? <ListPager page={paged.meta.page} pageSize={paged.meta.pageSize} total={paged.meta.total} basePath="/portal/visits" params={{ requestStatus: sp.requestStatus, q: sp.q }} locale={locale} /> : undefined}
      >

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
          <DataTable testId="portal-visit-rows">
            <thead>
              <tr>
                <Th>{locale === 'ar' ? 'الموعد' : 'Appointment'}</Th>
                <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                <Th>{locale === 'ar' ? 'حالة الموعد' : 'Appointment status'}</Th>
                <Th>{locale === 'ar' ? 'حالة الطلب' : 'Request status'}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const clientName  = v.lead?.fullName ?? v.customerName;
                const clientPhone = v.lead?.phone ?? v.customerPhone;
                const appt        = v.appointments?.[0];
                const urgency     = appointmentUrgency(appt?.scheduledAt, t.urgency);
                const isToday     = urgency?.key === 'today';
                return (
                  <Tr key={v.id} testId="portal-visit-row" className={isToday ? 'bg-amber-500/[0.06] hover:bg-amber-500/10' : undefined}>
                    <Td>
                      {/* The appointment once booked, else the preferred day (date-only, UTC). */}
                      {appt ? (
                        <DateTile value={appt.scheduledAt} time={formatTime(appt.scheduledAt, locale)} timeZone={DEFAULT_TIME_ZONE} locale={locale} />
                      ) : (
                        <DateTile value={v.preferredDate} timeZone="UTC" locale={locale} />
                      )}
                    </Td>
                    <Td>
                      <PersonCell
                        name={clientName ?? '—'}
                        muted={!clientName}
                        phone={clientPhone}
                        href={v.lead ? `/portal/leads/${v.lead.id}` : undefined}
                      />
                    </Td>
                    <Td>
                      <UnitCell
                        cover={v.project?.id ? covers.get(v.project.id) : undefined}
                        project={v.project ? tx(v.project.name, locale) : undefined}
                        unit={v.unit?.code}
                        unitWord={locale === 'en' ? 'Unit:' : 'وحدة:'}
                      />
                    </Td>
                    <Td>
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
                        <span className="inline-flex items-center gap-1 text-[12.5px] text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          {t.awaitingScheduling}
                        </span>
                      )}
                      <p className="mt-1 text-[11.5px] text-slate-500">
                        {t.cols.preferredDate}: <bdi>{formatDate(v.preferredDate, locale, 'UTC')}</bdi>
                      </p>
                    </Td>
                    <Td>
                      {v.requestStatus ? <VisitRequestStatusBadge status={v.requestStatus} locale={locale} /> : <span className="text-slate-400">—</span>}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        )}

      </ListTableCard>
    </ListPage>
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
