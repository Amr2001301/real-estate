import Link from 'next/link';
import { QuickContact } from '@/components/crm/quick-contact';
import { CalendarClock, CheckCircle2, ExternalLink } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { FollowUpBucket, FollowUpLead, FollowUpSummary, Paged } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumFilterBar, PremiumFilterField } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { KIND_ICON, RESULT_TONE } from '@/components/crm/follow-up-icons';
import { followUpT } from '@/components/crm/follow-up-messages';

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
  searchParams: Promise<{ bucket?: string; q?: string; page?: string }>;
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
    safe(api.get<Paged<FollowUpLead>>(`/leads/follow-ups?bucket=${bucket}&page=${page}&pageSize=${PAGE_SIZE}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`)),
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

      <PremiumFilterBar method="get" action="/dashboard/follow-ups">
        <PremiumFilterField label={locale === 'en' ? 'Search' : 'بحث'} htmlFor="follow-q">
          <Input id="follow-q" name="q" defaultValue={sp.q ?? ''} placeholder={locale === 'en' ? 'Lead name or phone…' : 'ابحث باسم العميل المحتمل أو هاتفه…'} />
        </PremiumFilterField>
        <PremiumFilterField neutral label={f.page.title} htmlFor="follow-bucket">
          <Select id="follow-bucket" name="bucket" inputSize="sm" defaultValue={bucket} data-testid="follow-bucket">
            {BUCKETS.map((b) => (
              <option key={b} value={b}>{f.page.tabs[b]} ({summary[b]})</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <p className="text-[13px] text-slate-500">{f.page.hint[bucket]}</p>

      {listRes.error ? (
        <div role="alert" className="rounded-card bg-danger-500/10 p-6 text-sm text-danger-600">
          {f.page.error}: {listRes.error}
        </div>
      ) : rows.length === 0 ? (
        <div data-testid="follow-empty" className="flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline bg-surface px-6 py-14 text-center">
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
                  'grid grid-cols-1 gap-4 rounded-card border border-hairline bg-surface p-4 sm:p-5 lg:grid-cols-[1.3fr_1.2fr_1.3fr_auto] lg:items-center',
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
                  <QuickContact leadId={l.id} phone={phone} kind="CALL" label={f.page.call} />
                  <QuickContact leadId={l.id} phone={phone} kind="WHATSAPP" label={f.page.whatsapp} />
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
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/dashboard/follow-ups" params={{ bucket, q: sp.q }} locale={locale} />
      )}
    </div>
  );
}
