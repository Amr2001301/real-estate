'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { createBuildingAction, createPhaseAction, updatePhaseDeliveryAction, type ProjectFormState } from '../actions';

// The project page's inline "add phase" / "add building" forms. A refused
// create (a missing or taken code) shows its message under the form instead
// of throwing into the error page.

const CODE_PATTERN = '[A-Za-z0-9][A-Za-z0-9\\-]{1,63}';

const INPUT =
  'h-10 w-full rounded-xl border border-hairline bg-surface px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

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
  return (
    <form
      action={formAction}
      data-testid="phase-create-form"
      className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Labeled label={m.phaseNameArPlaceholder}>
        <input name="name_ar" required dir="rtl" placeholder={m.phaseNameArPlaceholder} className={INPUT} />
      </Labeled>
      <Labeled label={m.phaseNameEnLabel}>
        <input name="name_en" required dir="ltr" placeholder="Phase name (English)" className={INPUT} />
      </Labeled>
      <Labeled label={m.phaseCodePlaceholder}>
        <input
          name="code"
          required
          dir="ltr"
          pattern={CODE_PATTERN}
          title={m.codeTitle}
          placeholder="PH-1"
          className={`${INPUT} uppercase`}
        />
      </Labeled>
      <Labeled label={m.phaseDeliveryLabel}>
        <input name="deliveryDate" type="date" className={INPUT} />
      </Labeled>
      <Labeled label={m.phaseOrderLabel}>
        <input name="order" type="number" min={0} defaultValue={nextOrder} className={INPUT} />
      </Labeled>
      <div className="flex items-end">
        <Button type="submit" variant="primary" size="md" className="w-full">
          {m.btnAdd}
        </Button>
      </div>
      <FormError state={state} />
    </form>
  );
}

/** A phase's handover date, set or changed from its card (F10). */
export function PhaseDeliveryForm({
  projectId,
  phaseId,
  deliveryDate,
  locale = 'ar',
}: {
  projectId: string;
  phaseId: string;
  deliveryDate?: string | null;
  locale?: Locale;
}) {
  const m = uiT(locale).projectDetailPage;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    updatePhaseDeliveryAction.bind(null, projectId, phaseId),
    {},
  );
  return (
    <form action={formAction} data-testid="phase-delivery-form" data-phase-id={phaseId} className="mt-2 flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-500">{m.phaseDeliveryLabel}</label>
      <input
        name="deliveryDate"
        type="date"
        defaultValue={deliveryDate?.slice(0, 10) ?? ''}
        className="h-9 rounded-xl border border-hairline bg-surface px-3 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
      />
      <Button type="submit" variant="outline" size="sm">
        {m.btnSave}
      </Button>
      {state.ok && <span className="text-xs text-success-700">{m.phaseDeliverySaved}</span>}
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
  return (
    <form
      action={formAction}
      data-testid="building-create-form"
      className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-hairline bg-surface p-4 sm:grid-cols-[1fr_1fr_8rem_auto]"
    >
      <input type="hidden" name="phaseId" value={phaseId} />
      <Labeled label={m.buildingNamePlaceholder}>
        <input name="name" required placeholder="A" className={INPUT} />
      </Labeled>
      <Labeled label={m.buildingCodePlaceholder}>
        <input
          name="code"
          required
          dir="ltr"
          pattern={CODE_PATTERN}
          title={m.codeTitle}
          placeholder="B1"
          className={`${INPUT} uppercase`}
        />
      </Labeled>
      <Labeled label={m.floorsPlaceholder}>
        <input name="totalFloors" type="number" min={1} defaultValue={1} className={INPUT} />
      </Labeled>
      <div className="flex items-end">
        <Button type="submit" variant="primary" size="md" className="w-full">
          {m.btnSave}
        </Button>
      </div>
      <FormError state={state} />
    </form>
  );
}
