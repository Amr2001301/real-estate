import Link from 'next/link';
import { CalendarClock, CheckCircle2, ExternalLink, MessageCircle, Phone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { FollowUpBucket, FollowUpLead, FollowUpSummary, Paged } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { KIND_ICON, RESULT_TONE } from '@/components/crm/follow-up-icons';
import { followUpT, whatsappHref } from '@/components/crm/follow-up-messages';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const BUCKETS: FollowUpBucket[] = ['overdue', 'today', 'upcoming'];
const PAGE_SIZE = 20;

const TONE: Record<FollowUpBucket, { tab: string; count: string; due: string }> = {
  overdue: { tab: 'border-danger-500 text-danger-700', count: 'bg-danger-500 text-white', due: 'text-danger-600' },
  today: { tab: 'border-amber-500 text-amber-700', count: 'bg-amber-500 text-white', due: 'text-amber-600' },
  upcoming: { tab: 'border-brand-500 text-brand-700', count: 'bg-brand-500 text-white', due: 'text-brand-700' },
};

/** «المتابعات» — the leads due a contact, overdue first. */
export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const bucket: FollowUpBucket = BUCKETS.includes(sp.bucket as FollowUpBucket) ? (sp.bucket as FollowUpBucket) : 'overdue';
  const page = Math.max(1, Number(sp.page) || 1);
  const locale = await getLocale();
  const f = followUpT(locale);
  const session = await getSession();
  const showOwner = session?.role !== 'SALES';

  const [summaryRes, listRes] = await Promise.all([
    safe(api.get<FollowUpSummary>('/leads/follow-ups/summary')),
    safe(api.get<Paged<FollowUpLead>>(`/leads/follow-ups?bucket=${bucket}&page=${page}&pageSize=${PAGE_SIZE}`)),
  ]);
  const summary = summaryRes.data ?? { overdue: 0, today: 0, upcoming: 0 };
  const rows = listRes.data?.data ?? [];
  const total = listRes.data?.meta.total ?? 0;

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={f.page.eyebrow}
        title={f.page.title}
        description={f.page.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: f.page.title }]}
      />

      <nav role="tablist" aria-label={f.page.title} className="flex flex-wrap gap-2 border-b border-hairline">
        {BUCKETS.map((b) => {
          const on = b === bucket;
          return (
            <Link
              key={b}
              role="tab"
              aria-selected={on}
              data-testid={`follow-tab-${b}`}
              href={`/dashboard/follow-ups?bucket=${b}` as never}
              className={cn(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors',
                on ? TONE[b].tab : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {f.page.tabs[b]}
              <span
                className={cn(
                  'inline-flex min-w-[22px] justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                  summary[b] > 0 ? TONE[b].count : 'bg-surface-muted text-slate-500',
                )}
              >
                {summary[b]}
              </span>
            </Link>
          );
        })}
      </nav>

      <p className="text-[13px] text-slate-500">{f.page.hint[bucket]}</p>

      {listRes.error ? (
        <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">
          {f.page.error}: {listRes.error}
        </div>
      ) : rows.length === 0 ? (
        <div data-testid="follow-empty" className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-hairline bg-surface px-6 py-14 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="font-heading text-[16px] font-semibold text-slate-800">{f.page.empty[bucket]}</p>
          <p className="max-w-md text-[13px] text-slate-500">{f.page.emptyHint}</p>
        </div>
      ) : (
        <ul data-testid="follow-list" className="flex flex-col gap-3">
          {rows.map((l) => {
            const name = l.client?.fullName ?? l.fullName;
            const phone = l.client?.phone ?? l.phone;
            const type = l.nextActionType ?? 'FOLLOW_UP';
            const TypeIcon = KIND_ICON[type];
            const last = l.lastActivity;
            const LastIcon = last ? KIND_ICON[last.kind] : null;
            return (
              <li
                key={l.id}
                data-testid="follow-row"
                className={cn(
                  'grid grid-cols-1 gap-4 rounded-[20px] border border-hairline bg-surface p-4 sm:p-5 lg:grid-cols-[1.3fr_1.2fr_1.3fr_auto] lg:items-center',
                  bucket === 'overdue' && 'border-s-4 border-s-danger-500',
                )}
              >
                <div className="min-w-0">
                  <Link href={`/dashboard/leads/${l.id}` as never} className="block truncate font-heading text-[15px] font-semibold text-slate-900 hover:text-brand-700">
                    {name}
                  </Link>
                  <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                    <span dir="ltr">{phone}</span>
                    {l.projectInterest && <> · {tx(l.projectInterest.name)}</>}
                  </p>
                  {showOwner && l.assignedSales && (
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {f.page.owner}: <span className="font-semibold text-slate-700">{l.assignedSales.fullName}</span>
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <p className={cn('flex items-center gap-1.5 text-[13px] font-semibold', TONE[bucket].due)}>
                    <CalendarClock className="h-4 w-4" />
                    <span className="tabular-nums">{formatDateTime(l.nextActionAt, locale)}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-700">
                    <TypeIcon className="h-3.5 w-3.5 text-slate-400" /> {f.nextType[type]}
                    {l.nextActionNote && <span className="truncate text-slate-500">— {l.nextActionNote}</span>}
                  </p>
                </div>

                <div className="min-w-0 text-[12.5px]">
                  <p className="text-[11.5px] font-semibold text-slate-400">{f.page.last}</p>
                  {last && LastIcon ? (
                    <>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-700">
                        <LastIcon className="h-3.5 w-3.5 text-slate-400" /> {f.kind[last.kind]}
                        {last.callResult && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', RESULT_TONE[last.callResult])}>
                            {f.callResult[last.callResult]}
                          </span>
                        )}
                        <span className="tabular-nums text-slate-400">· {formatDateTime(last.createdAt, locale)}</span>
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-slate-500">{last.body}</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-slate-400">{f.page.noActivity}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <a href={`tel:${phone}`} aria-label={f.page.call} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-600 hover:border-brand-500/50 hover:text-brand-700">
                    <Phone className="h-4 w-4" />
                  </a>
                  <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" aria-label={f.page.whatsapp} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-emerald-600 hover:border-emerald-500/50">
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  <Link
                    href={`/dashboard/leads/${l.id}` as never}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white hover:bg-brand-700"
                  >
                    {f.page.open} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/dashboard/follow-ups" params={{ bucket }} locale={locale} />
      )}
    </div>
  );
}
