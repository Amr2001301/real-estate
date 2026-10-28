import { CheckCircle2, Info } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { DuplicateGroup } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { duplicateT } from '@/components/crm/duplicate-messages';
import { DuplicateGroupCard } from './_components/duplicate-group';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** «فرص مكررة» — customers with more than one open lead, and merging them. */
export default async function DuplicateLeadsPage() {
  const locale = await getLocale();
  const m = duplicateT(locale);
  const res = await safe(api.get<{ groups: DuplicateGroup[]; total: number }>('/leads/duplicates'));
  const groups = res.data?.groups ?? [];

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.back, href: '/dashboard/leads' },
          { label: m.title },
        ]}
      />

      {res.error ? (
        <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{res.error}</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-hairline bg-surface px-6 py-14 text-center" data-testid="duplicates-empty">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="font-heading text-[17px] font-semibold text-slate-800">{m.empty}</p>
          <p className="text-[13px] text-slate-500">{m.emptyDesc}</p>
        </div>
      ) : (
        <>
          <p className="flex items-start gap-2 rounded-[18px] bg-surface-muted/50 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {m.how}
          </p>
          <p className="text-[13px] font-semibold text-slate-500">{m.count(groups.length)}</p>
          <div className="space-y-4">
            {groups.map((g) => (
              <DuplicateGroupCard key={g.client.id} group={g} locale={locale} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
