'use client';

import Link from 'next/link';
import { useTransition, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { createLeadAnywayAction, type LeadFormState } from '@/app/dashboard/leads/actions';

/* DUP2 — adding a lead for a customer who already has an open lead. */
const T = {
  ar: {
    title: 'العميل ده عنده فرصة مفتوحة بالفعل',
    desc: 'إضافة فرصة تانية بتقسم متابعته بين فرصتين. الأفضل تكمّل على الموجودة، أو تضيف جديدة لو ده طلب مختلف فعلًا.',
    owner: 'المسؤول',
    none: 'بدون مسؤول',
    added: 'اتضافت',
    open: 'افتح الفرصة',
    anyway: 'أضف فرصة جديدة على أي حال',
    stage: { NEW: 'جديد', INTERESTED: 'مهتم', VISIT: 'زيارة', NEGOTIATION: 'تفاوض' } as Record<string, string>,
  },
  en: {
    title: 'This customer already has an open lead',
    desc: 'A second lead splits their follow-up in two. Carry on with the open one, or add a new one if this is really a different request.',
    owner: 'Owner',
    none: 'Unassigned',
    added: 'Added',
    open: 'Open the lead',
    anyway: 'Add a new lead anyway',
    stage: { NEW: 'New', INTERESTED: 'Interested', VISIT: 'Visit', NEGOTIATION: 'Negotiation' } as Record<string, string>,
  },
};

export function OpenLeadWarning({ duplicate, locale = 'ar' }: { duplicate: NonNullable<LeadFormState['duplicate']>; locale?: Locale }) {
  const m = locale === 'en' ? T.en : T.ar;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div role="alert" data-testid="open-lead-warning" className="rounded-2xl border border-[#D8B66A]/50 bg-[#D8B66A]/10 px-5 py-4 shadow-soft">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B38B3A]" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[14px] font-bold text-slate-900">{m.title}</p>
            <p className="mt-1 text-[12.5px] text-slate-600">{m.desc}</p>
          </div>
          <ul className="space-y-2">
            {duplicate.leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3 py-2">
                <span className="text-[12.5px] text-slate-700">
                  <span className="font-semibold">{m.stage[l.stage] ?? l.stage}</span>
                  {' · '}
                  {m.owner}: {l.assignedSales?.fullName ?? m.none}
                  {' · '}
                  {m.added} {formatDate(l.createdAt, locale)}
                </span>
                <Link
                  href={`/dashboard/leads/${l.id}` as never}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline"
                >
                  {m.open}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
          {error && <p className="text-[12.5px] font-semibold text-danger-600">{error}</p>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="add-lead-anyway"
            onClick={() =>
              start(async () => {
                const res = await createLeadAnywayAction(duplicate.payload);
                if (res?.error) setError(res.error);
              })
            }
          >
            {m.anyway}
          </Button>
        </div>
      </div>
    </div>
  );
}
