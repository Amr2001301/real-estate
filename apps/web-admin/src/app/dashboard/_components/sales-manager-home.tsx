import Link from 'next/link';
import {
  Plus, CalendarPlus, Target, Wallet, Clock, AlertTriangle, UserX, CheckCircle2, Hourglass, Crown,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getCompanyTimeZone, getReportsCurrency, currencySymbol, todayIn } from '@/lib/currency';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { compactParts } from '@/lib/format';
import { cn } from '@/lib/cn';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { ReservationStatusBadge } from '@/components/badges';
import {
  Avatar,
  CommandBand,
  BandAction,
  TargetRing,
  Panel,
  LeadBoard,
  Agenda,
  ExpiryCards,
} from '@/components/cockpit/cockpit';
import { STALE_AFTER_DAYS, greeting, daysLeftInMonth, daysUntil, loadBoard, buildAgenda } from './cockpit-data';

interface PerformanceRow {
  salesId:                 string;
  salesName:               string;
  leadsCount:              number;
  openLeadsCount:          number;
  visitsCount:             number;
  reservationsCount:       number;
  signedContractsCount:    number;
  realizedValue:           number;
  targetAmount:            number | null;
  targetUnits:             number | null;
  achievedAmount:          number;
  achievedUnits:           number;
  targetAmountPercent:     number | null;
}

interface Attention {
  key: string;
  icon: React.ReactNode;
  tone: 'amber' | 'sky' | 'rose';
  title: string;
  desc: string;
  count?: number;
  href?: string;
}

const ATTENTION_TONE = {
  amber: 'bg-amber-500/12 text-amber-600',
  sky:   'bg-sky-500/12 text-sky-600',
  rose:  'bg-rose-500/12 text-rose-500',
} as const;

/**
 * The sales manager's home, a command center: the team's month against its
 * target in the navy band, the team ranking beside what needs the manager,
 * the team's lead board, then the agenda and the bookings by expiry.
 */
export async function SalesManagerDashboard() {
  const [locale, timeZone, currency, session] = await Promise.all([
    getLocale(), getCompanyTimeZone(), getReportsCurrency(), getSession(),
  ]);
  const t = uiT(locale).pages;
  const c = t.cockpit;
  const m = t.salesManagerHome;
  const symbol = currencySymbol(currency, locale);
  const today = todayIn(timeZone);
  const period = today.slice(0, 7);
  const periodLabel = `${m.monthsAr[Number(period.slice(5, 7)) - 1] ?? period} ${period.slice(0, 4)}`;

  const now = new Date();
  const nowIso = now.toISOString();
  const staleIso = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();
  const in7Iso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Team-scoped by the API; every count is the server's (meta.total / facets).
  const [perfRes, leadsRes, staleRes, resvRes, activeRes, expiringRes, visitsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<Paged<Lead>>('/leads?pageSize=1')),
    safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=1')),
    safe(api.get<Paged<Reservation>>('/reservations?status=PENDING,APPROVED&sort=expiresAt&pageSize=6')),
    safe(api.get<Paged<Reservation>>(`/reservations?status=PENDING,APPROVED&expiresFrom=${nowIso}&expiresTo=${in7Iso}&sort=expiresAt&pageSize=20`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?scheduledFrom=${nowIso}&open=true&pageSize=12`)),
  ]);

  const perf = (perfRes.data ?? []).slice().sort((a, b) => b.realizedValue - a.realizedValue);
  const stages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resv = resvRes.data?.meta.facets?.counts?.status ?? {};
  const openLeads = (leadsRes.data?.meta.total ?? 0) - (stages.WON ?? 0) - (stages.LOST ?? 0);
  const stale = staleRes.data?.meta.total ?? 0;
  const activeReservations = (resv.PENDING ?? 0) + (resv.APPROVED ?? 0);
  const pending = resv.PENDING ?? 0;
  const expiring7 = expiringRes.data?.meta.total ?? 0;
  const visits = (visitsRes.data?.data ?? []).slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const lapsing = (expiringRes.data?.data ?? []).filter((r) => daysUntil(r.expiresAt) <= 2);

  // Team target: only the sales of reps who have one count toward it (a rep
  // with no target pushed the team past 100%).
  const sum = (pick: (r: PerformanceRow) => number) => perf.reduce((a, r) => a + pick(r), 0);
  const teamTarget = sum((r) => r.targetAmount ?? 0);
  const teamOnTarget = sum((r) => (r.targetAmount ? r.achievedAmount : 0));
  const teamPct = teamTarget > 0 ? (teamOnTarget / teamTarget) * 100 : null;
  const teamUnitsTarget = sum((r) => r.targetUnits ?? 0);
  const teamUnits = sum((r) => r.achievedUnits);
  const isActive = (r: PerformanceRow) => r.leadsCount + r.visitsCount + r.reservationsCount + r.signedContractsCount > 0;
  const activeReps = perf.filter(isActive).length;
  const inactive = perf.filter((r) => !isActive(r));
  const money = (n: number) => compactParts(n, symbol, locale).join(' ');

  const attention: Attention[] = [
    ...(pending > 0 ? [{
      key: 'pending', icon: <Hourglass />, tone: 'sky' as const, count: pending,
      title: m.alertPendingLabel, desc: m.alertPendingDesc(pending), href: '/dashboard/reservations?status=PENDING',
    }] : []),
    ...(expiring7 > 0 ? [{
      key: 'expiring', icon: <Clock />, tone: 'amber' as const, count: expiring7,
      title: m.alertExpiringLabel, desc: m.alertExpiringDesc(expiring7), href: '/dashboard/reservations',
    }] : []),
    ...(stale > 0 ? [{
      key: 'stale', icon: <AlertTriangle />, tone: 'amber' as const, count: stale,
      title: c.openLeads, desc: c.staleHint(stale), href: '/dashboard/leads?stage=NEW,INTERESTED',
    }] : []),
    ...(inactive.length > 0 ? [{
      key: 'inactive', icon: <UserX />, tone: 'rose' as const, count: inactive.length,
      title: m.alertInactiveRepsLabel,
      desc: inactive.slice(0, 3).map((r) => r.salesName).join(m.listSeparator) +
        (inactive.length > 3 ? m.alertInactiveRepsMore(inactive.length - 3) : ''),
    }] : []),
  ];

  const stageLabels = {
    NEW: m.stageLabelNew,
    INTERESTED: m.stageLabelInterested,
    VISIT: m.stageLabelVisit,
    NEGOTIATION: m.stageLabelNegotiation,
  };
  const board = await loadBoard(stages, c, locale, true, stageLabels);
  const agenda = buildAgenda(visits, lapsing, c, locale, timeZone, true);

  return (
    <div className="space-y-6">
      <CommandBand
        kicker={c.managerSubtitle}
        greeting={greeting(c, timeZone, session?.fullName ?? '')}
        summary={c.teamSummary(activeReps, perf.length)}
        actions={
          <>
            <BandAction primary href="/dashboard/leads/new" icon={<Plus />}>{m.btnAddLead}</BandAction>
            <BandAction href="/dashboard/visits/new" icon={<CalendarPlus />}>{m.btnScheduleVisit}</BandAction>
            <BandAction href="/dashboard/targets" icon={<Target />}>{c.manageTargets}</BandAction>
            <BandAction href="/dashboard/my-compensation" icon={<Wallet />}>{m.btnMyCompensation}</BandAction>
          </>
        }
        ring={
          <>
            <TargetRing pct={teamPct ?? 0}>
              <span className="text-[30px] font-bold leading-none tabular-nums">{teamPct !== null ? `${Math.round(teamPct)}%` : '—'}</span>
              <span className="mt-1 text-[11px] text-[#A9B0BD]">{c.teamTarget}</span>
            </TargetRing>
            <div className="space-y-1.5 text-[13px]">
              <p className="font-bold text-[#F4ECD8]">
                {teamTarget > 0 ? c.ofTarget(money(teamOnTarget), money(teamTarget)) : c.noTarget}
              </p>
              {teamUnitsTarget > 0 && <p className="text-[#A9B0BD]">{teamUnits} / {teamUnitsTarget} {c.units}</p>}
              <p className="text-[#D8B66A]">{c.daysLeft(daysLeftInMonth(today))}</p>
            </div>
          </>
        }
        facts={[
          { label: c.realized, value: money(sum((r) => r.realizedValue)) },
          { label: c.contractsMonth, value: sum((r) => r.signedContractsCount) },
          { label: c.openLeads, value: openLeads },
          { label: c.activeReservations, value: activeReservations },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
        <Panel
          testId="leaderboard"
          className="xl:col-span-2"
          title={c.leaderboard}
          sub={c.leaderboardSub(periodLabel)}
          link={{ href: '/dashboard/sales/performance', label: c.viewAll }}
        >
          {perf.length === 0 ? (
            <p className="mx-6 mb-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{m.teamPerfEmpty}</p>
          ) : (
            <ol className="divide-y divide-hairline border-t border-hairline">
              {perf.map((r, i) => {
                const p = r.targetAmountPercent;
                const active = isActive(r);
                return (
                  <li key={r.salesId} className={cn('flex flex-wrap items-center gap-4 px-6 py-4', i === 0 && active && 'bg-brand-500/[0.05]')}>
                    <span
                      className={cn(
                        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                        i === 0 && active ? 'bg-gradient-to-br from-[#E6C77E] to-[#C9A24E] text-[#1a1408]' : 'bg-surface-muted text-slate-500',
                      )}
                    >
                      {i === 0 && active ? <Crown className="h-4 w-4" /> : i + 1}
                    </span>
                    <Avatar name={r.salesName} size="lg" />
                    <div className="min-w-[180px] flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-bold text-slate-900" dir="auto">{r.salesName}</p>
                        {!active && (
                          <span className="shrink-0 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">{c.inactive}</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              p === null ? 'bg-slate-400/40' : p >= 100 ? 'bg-emerald-400' : p >= 60 ? 'bg-gradient-to-l from-brand-400 to-brand-600' : 'bg-amber-400',
                            )}
                            style={{ width: `${Math.min(100, p ?? 0)}%` }}
                          />
                        </div>
                        <span className={cn('w-12 shrink-0 text-end text-[13px] font-bold tabular-nums', p === null ? 'text-slate-400' : p >= 100 ? 'text-emerald-600' : 'text-slate-800')}>
                          {p === null ? '—' : `${Math.round(p)}%`}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-slate-500">
                        {r.targetAmount ? c.ofTarget(money(r.achievedAmount), money(r.targetAmount)) : c.noTargetShort}
                      </p>
                    </div>
                    <dl className="flex shrink-0 items-center gap-px overflow-hidden rounded-xl border border-hairline bg-hairline text-center">
                      {[
                        [c.leads, r.leadsCount],
                        [c.visits, r.visitsCount],
                        [c.reservations, r.reservationsCount],
                        [c.contracts, r.signedContractsCount],
                      ].map(([label, v]) => (
                        <div key={label as string} className="bg-surface px-3 py-1.5">
                          <dt className="text-[10.5px] text-slate-500">{label}</dt>
                          <dd className="text-[15px] font-bold tabular-nums text-slate-900">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="w-32 shrink-0 text-end">
                      <p className="text-[10.5px] text-slate-500">{c.realized}</p>
                      <p className="whitespace-nowrap text-[14px] font-bold tabular-nums text-brand-700">{money(r.realizedValue)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel testId="attention" title={c.attention}>
          {attention.length === 0 ? (
            <div className="mx-6 mb-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <p className="text-[13px] text-slate-500">{c.attentionEmpty}</p>
            </div>
          ) : (
            <ul className="space-y-2 px-4 pb-5">
              {attention.map((a) => {
                const body = (
                  <>
                    <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]', ATTENTION_TONE[a.tone])}>
                      {a.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold text-slate-900">{a.title}</span>
                      <span className="block truncate text-[12px] text-slate-500">{a.desc}</span>
                    </span>
                    {a.count !== undefined && (
                      <span className="text-[22px] font-bold tabular-nums text-slate-900">{a.count}</span>
                    )}
                  </>
                );
                return (
                  <li key={a.key}>
                    {a.href ? (
                      <Link href={a.href as never} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-muted/30 px-3.5 py-3 transition-colors hover:border-brand-500/40">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-muted/30 px-3.5 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel testId="lead-board-panel" title={c.board} sub={c.boardSub} link={{ href: '/dashboard/leads', label: c.viewAll }}>
        <LeadBoard columns={board} emptyLabel={c.boardEmpty} viewAllLabel={c.viewAll} staleLabel={c.stale} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
        <Panel title={c.teamAgenda} sub={c.agendaSub} link={{ href: '/dashboard/visits?tab=appointments', label: c.viewAll }}>
          <Agenda items={agenda} emptyLabel={c.agendaEmpty} />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={c.reservationsTitle}
          sub={c.reservationsSub}
          link={{ href: '/dashboard/reservations', label: c.viewAll }}
        >
          <ExpiryCards
            cols={2}
            emptyLabel={c.reservationsEmpty}
            items={(activeRes.data?.data ?? []).map((r) => ({
              id: r.id,
              href: `/dashboard/reservations/${r.id}`,
              code: r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`,
              unit: r.unit?.code,
              client: r.lead?.fullName ?? r.client?.fullName ?? '—',
              owner: r.sales?.fullName,
              daysLeft: daysUntil(r.expiresAt),
              expiryLabel: c.expiresIn(daysUntil(r.expiresAt)),
              status: <ReservationStatusBadge status={r.status} locale={locale} />,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
