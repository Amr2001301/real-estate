'use client';

import { useActionState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { setPlansVisibilityAction, type VisibilityState } from '../actions';

/** The form the row checkboxes belong to (`form` attribute). */
export const PLAN_VISIBILITY_FORM = 'plan-visibility';

/**
 * The plan list's bulk bar: tick plans in the table, then show them to
 * customers and brokers, or keep them for sales only.
 */
export function BulkVisibilityBar({ locale = 'ar' }: { locale?: Locale }) {
  const m = uiT(locale).pages.installments.bulk;
  const [state, action, pending] = useActionState<VisibilityState, FormData>(
    setPlansVisibilityAction,
    {},
  );

  function toggleAll(checked: boolean) {
    document
      .querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${PLAN_VISIBILITY_FORM}"]`)
      .forEach((c) => {
        c.checked = checked;
      });
  }

  return (
    <form
      id={PLAN_VISIBILITY_FORM}
      action={action}
      className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-hairline bg-canvas/30"
    >
      <label className="inline-flex items-center gap-2 text-sm text-slate-600 me-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-hairline accent-brand-600"
          onChange={(e) => toggleAll(e.currentTarget.checked)}
          aria-label={m.selectAll}
        />
        {m.selectAll}
      </label>
      <Button
        type="submit"
        name="visibility"
        value="PUBLIC"
        variant="primary"
        size="sm"
        disabled={pending}
      >
        <Eye className="h-4 w-4" />
        {m.showToCustomers}
      </Button>
      <Button
        type="submit"
        name="visibility"
        value="SALES_ONLY"
        variant="secondary"
        size="sm"
        disabled={pending}
      >
        <EyeOff className="h-4 w-4" />
        {m.salesOnly}
      </Button>
      <span className="text-xs text-slate-500" role="status">
        {state.updated != null
          ? m.done(state.updated)
          : state.error === 'none'
            ? m.none
            : (state.error ?? m.hint)}
      </span>
    </form>
  );
}
