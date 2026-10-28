import Link from 'next/link';
import { QuickContact } from '@/components/crm/quick-contact';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { FollowUpLead, FollowUpSummary, Paged } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { formatDateTime } from '@/lib/format';
import { PremiumPanel } from '@/components/premium';
import { cn } from '@/lib/cn';
import { KIND_ICON } from './follow-up-icons';
import { followUpT } from './follow-up-messages';

/**
 * «متابعات اليوم» on the dashboard home: how many follow-ups are overdue,
 * due today and upcoming, and the first few to act on now.
 */
export async function FollowUpsPanel({ locale, limit = 5 }: { locale: Locale; limit?: number }) {
  const f = followUpT(locale);
  const [summaryRes, overdueRes, todayRes] = await Promise.all([
    safe(api.get<FollowUpSummary>('/leads/follow-ups/summary')),
    safe(api.get<Paged<FollowUpLead>>(`/leads/follow-ups?bucket=overdue&pageSize=${limit}`)),
    safe(api.get<Paged<FollowUpLead>>(`/leads/follow-ups?bucket=today&pageSize=${limit}`)),
  ]);
  if (summaryRes.error) return null;
  const summary = summaryRes.data ?? { overdue: 0, today: 0, upcoming: 0 };
  const rows = [
    ...(overdueRes.data?.data ?? []).map((l) => ({ l, overdue: true })),
    ...(todayRes.data?.data ?? []).map((l) => ({ l, overdue: false })),
  ].slice(0, limit);

  const tiles = [
    { key: 'overdue' as const, n: summary.overdue, on: 'bg-danger-500/10 text-danger-700' },
    { key: 'today' as const, n: summary.today, on: 'bg-amber-500/12 text-amber-700' },
    { key: 'upcoming' as const, n: summary.upcoming, on: 'bg-brand-500/10 text-brand-800' },
  ];

  return (
    <div data-testid="follow-ups-panel">
      <PremiumPanel title={f.panel.title} sub={f.panel.desc} link={{ href: '/dashboard/follow-ups', label: f.panel.all }}>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/follow-ups?bucket=${t.key}` as never}
              data-testid={`follow-count-${t.key}`}
              className={cn(
                'rounded-2xl px-3 py-2.5 transition-opacity hover:opacity-85',
                t.n > 0 ? t.on : 'bg-surface-muted text-slate-500',
              )}
            >
              <span className="block font-heading text-[22px] font-bold tabular-nums leading-none">{t.n}</span>
              <span className="mt-1 block text-[12px] font-semibold">{f.page.tabs[t.key]}</span>
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {f.panel.clear}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-hairline">
            {rows.map(({ l, overdue }) => {
              const phone = l.client?.phone ?? l.phone;
              const Icon = KIND_ICON[l.nextActionType ?? 'FOLLOW_UP'];
              return (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      overdue ? 'bg-danger-500/10 text-danger-600' : 'bg-amber-500/12 text-amber-600',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/leads/${l.id}` as never} className="block truncate text-[13.5px] font-semibold text-slate-900 hover:text-brand-700">
                      {l.client?.fullName ?? l.fullName}
                    </Link>
                    <p className={cn('flex items-center gap-1 text-[12px]', overdue ? 'text-danger-600' : 'text-amber-600')}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{formatDateTime(l.nextActionAt, locale)}</span>
                      <span className="truncate text-slate-500">· {f.nextType[l.nextActionType ?? 'FOLLOW_UP']}</span>
                    </p>
                  </div>
                  <QuickContact leadId={l.id} phone={phone} kind="CALL" label={f.page.call} />
                  <QuickContact leadId={l.id} phone={phone} kind="WHATSAPP" label={f.page.whatsapp} />
                </li>
              );
            })}
          </ul>
        )}
      </PremiumPanel>
    </div>
  );
}
