'use client';

import { useActionState } from 'react';
import type { Locale } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { setTwoFactorPolicyAction, type TwoFactorResult } from '@/lib/security-actions';
import { securityT } from './security-messages';

/** TFA1 — the admin's rule: optional, required for admins, or for all staff. */
export function TwoFactorPolicyForm({ mode, locale }: { mode: string; locale: Locale }) {
  const m = securityT(locale);
  const [state, action, pending] = useActionState<TwoFactorResult, FormData>(setTwoFactorPolicyAction, {});
  return (
    <form action={action} className="grid gap-3" data-testid="two-factor-policy">
      <p className="max-w-2xl text-[12.5px] text-slate-600">{m.policyDesc}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {(['OFF', 'ADMINS', 'STAFF'] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-hairline px-3 py-2.5 text-[13px] font-semibold text-slate-700 has-[:checked]:border-[#D8B66A] has-[:checked]:bg-[#D8B66A]/10">
            <input type="radio" name="mode" value={k} defaultChecked={mode === k} className="accent-[#B38B3A]" />
            {m.policy[k]}
          </label>
        ))}
      </div>
      {state.error && <p role="alert" className="text-[12.5px] font-semibold text-danger-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-[12.5px] font-semibold text-emerald-700">{m.policySaved}</p>}
      <div><Button type="submit" variant="primary" size="sm" disabled={pending}>{m.policySave}</Button></div>
    </form>
  );
}
