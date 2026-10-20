'use client';

import { useActionState, useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import type { Phase, Project, UnitTypeOption } from '@/lib/types';
import { tx } from '@/lib/format';
import { uiT } from '@/messages/ui';
import { getProjectPhasesAction } from '../actions';
import { repriceAction, type RepriceState } from './actions';

interface Props {
  projects: Pick<Project, 'id' | 'name' | 'city'>[];
  types: UnitTypeOption[];
  locale: Locale;
}

export function RepriceForm({ projects, types, locale }: Props) {
  const m = uiT(locale).pages.units.repriceForm;
  const [state, formAction] = useActionState<RepriceState, FormData>(repriceAction, {});
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [type, setType] = useState('');
  const [pricePerMeter, setPricePerMeter] = useState('');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [, startTransition] = useTransition();
  const buildings = phases.find((p) => p.id === phaseId)?.buildings ?? [];

  function pickProject(id: string) {
    setProjectId(id);
    setPhaseId('');
    setBuildingId('');
    setPhases([]);
    if (id) startTransition(async () => setPhases(await getProjectPhasesAction(id)));
  }

  return (
    <form
      className="flex flex-col gap-5"
      data-testid="reprice-form"
      // Sent by hand, not as the form's action: React resets a form after its
      // action, and "apply" follows a preview of the same values.
      onSubmit={(e) => {
        e.preventDefault();
        const apply = (e.nativeEvent as SubmitEvent).submitter?.dataset.mode === 'apply';
        if (apply && !window.confirm(m.confirm)) return;
        const data = new FormData(e.currentTarget);
        data.set('mode', apply ? 'apply' : 'preview');
        startTransition(() => formAction(data));
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label={m.project} name="projectId" required>
          <Select id="projectId" name="projectId" required value={projectId} onChange={(e) => pickProject(e.target.value)}>
            <option value="">{m.pickProject}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name, locale) || p.city}</option>
            ))}
          </Select>
        </Field>
        <Field label={m.phase} name="phaseId" hint={m.allHint}>
          <Select id="phaseId" name="phaseId" value={phaseId} onChange={(e) => {
              setPhaseId(e.target.value);
              setBuildingId('');
            }}>
            <option value="">{m.allPhases}</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name, locale) || p.code}</option>
            ))}
          </Select>
        </Field>
        <Field label={m.building} name="buildingId" hint={m.allHint}>
          <Select id="buildingId" name="buildingId" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">{m.allBuildings}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name || b.code}</option>
            ))}
          </Select>
        </Field>
        <Field label={m.type} name="type">
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{m.allTypes}</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>{tx(t.name, locale) || t.code}</option>
            ))}
          </Select>
        </Field>
        <Field label={m.pricePerMeter} name="pricePerMeter" required>
          <Input
            id="pricePerMeter"
            name="pricePerMeter"
            type="number"
            step="any"
            min={0}
            required
            value={pricePerMeter}
            onChange={(e) => setPricePerMeter(e.target.value)}
          />
        </Field>
      </div>

      <p className="text-sm text-slate-500">{m.note}</p>

      {state.error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.result && (
        <div
          data-testid="reprice-result"
          className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">
              {(state.result.applied ? m.applied : m.preview)
                .replace('{updated}', String(state.result.updated))
                .replace('{kept}', String(state.result.kept))}
            </p>
            {state.result.stalePlans > 0 && (
              <p>{m.stalePlans.replace('{n}', String(state.result.stalePlans))}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="outline" data-mode="preview">
          {m.previewBtn}
        </Button>
        <Button type="submit" variant="primary" data-mode="apply">
          {m.applyBtn}
        </Button>
      </div>
    </form>
  );
}
