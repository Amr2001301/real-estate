'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2, Shuffle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/app/dashboard/deals/_components/ui';
import { developersT } from '@/components/developers/messages';
import { distributeAction, type MatchFormState } from './actions';

interface Rep {
  id: string;
  fullName: string;
  openLeads: number;
}

/** Pick the reps; the unassigned leads go to whoever holds the fewest open leads. */
export function DistributeForm({ locale, reps, unassigned }: { locale: Locale; reps: Rep[]; unassigned: number }) {
  const t = developersT(locale).distribute;
  const [state, action, pending] = useActionState<MatchFormState & { assigned?: number }, FormData>(distributeAction, {});
  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="distribute-done">
        <CheckCircle2 className="h-10 w-10 text-success-600" />
        <p className="font-heading text-[20px] font-bold text-slate-900">{t.done(state.assigned ?? 0)}</p>
        <Link href={'/dashboard/leads' as never}>
          <Button variant="outline" size="md">{developersT(locale).list.apply}</Button>
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" data-testid="distribute-form">
      <ErrorLine error={state.error === 'pick' ? t.pickOne : state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reps.map((r) => (
          <label
            key={r.id}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:border-[#D8B66A]/50 has-[:checked]:border-[#D8B66A] has-[:checked]:bg-[#D8B66A]/[0.07]"
          >
            <input type="checkbox" name="salesIds" value={r.id} defaultChecked className="h-4 w-4 accent-[#B38B3A]" />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8B66A]/45 bg-[#D8B66A]/10 font-heading text-[15px] font-bold text-brand-700">
              {r.fullName.trim().charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold text-slate-900">{r.fullName}</span>
              <span className="num block text-[12px] text-slate-500">{t.openLeads(r.openLeads)}</span>
            </span>
          </label>
        ))}
      </div>
      <Button type="submit" variant="primary" size="md" leftIcon={<Shuffle className="h-4 w-4" />} disabled={pending || unassigned === 0} data-testid="distribute-submit">
        {t.submit(unassigned)}
      </Button>
    </form>
  );
}
