import Link from 'next/link';
import { Users } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Locale } from '@/lib/locale';
import { developersT, type LeadMatch } from '@/components/developers/messages';
import { Panel } from '@/app/dashboard/deals/_components/ui';
import { ReasonChips, ScoreBadge } from './lead-matches';

/** BRK-5 — on a listing: the caller's open leads it fits, best first. */
export async function ListingLeads({ listingId, locale }: { listingId: string; locale: Locale }) {
  const t = developersT(locale).match;
  const res = await safe(api.get<LeadMatch[]>(`/listings/${listingId}/matching-leads`));
  if (res.error) return null;
  const leads = res.data ?? [];
  return (
    <Panel icon={<Users />} title={t.leadsTitle} sub={t.leadsSub} testId="listing-leads">
      {leads.length === 0 ? (
        <p className="text-[13.5px] text-slate-500">{t.noLeads}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {leads.slice(0, 8).map((l) => (
            <li key={l.id}>
              <Link href={`/dashboard/leads/${l.id}` as never} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-brand-700">
                <ScoreBadge score={l.score} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-slate-900">{l.fullName}</p>
                  <p className="num truncate text-[12px] text-slate-500" dir="ltr">{l.phone}</p>
                  <div className="mt-1">
                    <ReasonChips reasons={l.reasons} locale={locale} />
                  </div>
                </div>
                {l.assignedSales && <span className="shrink-0 text-[12px] text-slate-500">{l.assignedSales.fullName}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
