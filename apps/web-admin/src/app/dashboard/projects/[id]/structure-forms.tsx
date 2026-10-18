'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { createBuildingAction, createPhaseAction, type ProjectFormState } from '../actions';

// The project page's inline "add phase" / "add building" forms. A refused
// create (a missing or taken code) shows its message under the form instead
// of throwing into the error page.

const CODE_PATTERN = '[A-Za-z0-9][A-Za-z0-9\\-]{1,63}';

function FormError({ state }: { state: ProjectFormState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="basis-full text-xs font-medium text-danger-700">
      {state.error}
    </p>
  );
}

export function PhaseCreateForm({
  projectId,
  nextOrder,
  locale = 'ar',
}: {
  projectId: string;
  nextOrder: number;
  locale?: Locale;
}) {
  const m = uiT(locale).projectDetailPage;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    createPhaseAction.bind(null, projectId),
    {},
  );
  const input =
    'text-sm h-9 rounded-lg border border-hairline bg-surface px-3 focus:outline-none focus:border-brand-500';
  return (
    <form
      action={formAction}
      data-testid="phase-create-form"
      className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_10rem_auto_auto] gap-2"
    >
      <input
        name="name_ar"
        required
        dir="rtl"
        placeholder={m.phaseNameArPlaceholder}
        className={input}
      />
      <input
        name="name_en"
        required
        dir="ltr"
        placeholder="Phase name (English)"
        className={input}
      />
      <input
        name="code"
        required
        dir="ltr"
        pattern={CODE_PATTERN}
        title={m.codeTitle}
        placeholder={m.phaseCodePlaceholder}
        className={`${input} uppercase`}
      />
      <input name="order" type="number" defaultValue={nextOrder} className={`w-20 ${input}`} />
      <Button type="submit" variant="primary" size="sm">
        {m.btnAdd}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export function BuildingCreateForm({
  projectId,
  phaseId,
  locale = 'ar',
}: {
  projectId: string;
  phaseId: string;
  locale?: Locale;
}) {
  const m = uiT(locale).projectDetailPage;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    createBuildingAction.bind(null, projectId),
    {},
  );
  const input =
    'text-xs h-8 rounded-lg border border-hairline bg-surface px-2.5 focus:outline-none focus:border-brand-500';
  return (
    <form
      action={formAction}
      data-testid="building-create-form"
      className="mt-2 flex flex-wrap gap-2"
    >
      <input type="hidden" name="phaseId" value={phaseId} />
      <input name="name" required placeholder={m.buildingNamePlaceholder} className={input} />
      <input
        name="code"
        required
        dir="ltr"
        pattern={CODE_PATTERN}
        title={m.codeTitle}
        placeholder={m.buildingCodePlaceholder}
        className={`w-32 ${input} uppercase`}
      />
      <input
        name="totalFloors"
        type="number"
        min={1}
        defaultValue={1}
        placeholder={m.floorsPlaceholder}
        className={`w-24 ${input}`}
      />
      <Button type="submit" variant="outline" size="sm">
        {m.btnSave}
      </Button>
      <FormError state={state} />
    </form>
  );
}
