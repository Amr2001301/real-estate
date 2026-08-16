'use client';

import { useEffect, useState, useTransition } from 'react';
import type { Phase, Project } from '@/lib/types';
import { Field } from '@/components/form/field';
import { Select } from '@/components/ui/select';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { getProjectPhasesAction } from './actions';

interface Props {
  projects: Project[];
  /** Prepopulate for the edit case — pass from unit.building.phase.projectId */
  initialProjectId?: string;
  /** Prepopulate for the edit case — pass from unit.building.phaseId */
  initialPhaseId?: string;
  /** Prepopulate for the edit case — pass from unit.buildingId */
  initialBuildingId?: string;
  locale?: Locale;
}

export function BuildingPicker({
  projects,
  initialProjectId = '',
  initialPhaseId = '',
  initialBuildingId = '',
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.buildingPicker;
  const [projectId, setProjectId] = useState(initialProjectId);
  const [phaseId, setPhaseId] = useState(initialPhaseId);
  const [buildingId, setBuildingId] = useState(initialBuildingId);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [isPending, startTransition] = useTransition();

  // On edit: load initial phases for the pre-selected project
  useEffect(() => {
    if (!initialProjectId) return;
    startTransition(async () => {
      const result = await getProjectPhasesAction(initialProjectId);
      setPhases(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProjectChange(newProjectId: string) {
    setProjectId(newProjectId);
    setPhaseId('');
    setBuildingId('');
    setPhases([]);
    if (!newProjectId) return;
    startTransition(async () => {
      const result = await getProjectPhasesAction(newProjectId);
      setPhases(result);
    });
  }

  const buildings = phases.find((ph) => ph.id === phaseId)?.buildings ?? [];

  return (
    <div className="space-y-3">
      {/* Hidden input always submits the real value — disabled selects are excluded from form data */}
      <input type="hidden" name="buildingId" value={buildingId} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={m.fieldProject} name="project" required>
          <Select
            id="project"
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            <option value="">{m.placeholderProject}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name?.ar ?? p.name?.en ?? p.city}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={m.fieldPhase} name="phase" required>
          <Select
            id="phase"
            value={phaseId}
            onChange={(e) => {
              setPhaseId(e.target.value);
              setBuildingId('');
            }}
            disabled={!projectId || isPending}
          >
            <option value="">
              {isPending
                ? m.loadingPhases
                : phases.length === 0 && projectId
                  ? m.noPhasesOption
                  : m.placeholderPhase}
            </option>
            {phases.map((ph) => (
              <option key={ph.id} value={ph.id}>
                {ph.name?.ar ?? ph.name?.en}
              </option>
            ))}
          </Select>
          {phases.length === 0 && projectId && !isPending && (
            <p className="mt-1 text-xs text-slate-500">
              {m.noPhasesHint}
            </p>
          )}
        </Field>

        <Field label={m.fieldBuilding} name="buildingId" required>
          <Select
            id="buildingId"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            disabled={!phaseId}
          >
            <option value="">
              {buildings.length === 0 && phaseId ? m.noBuildingsOption : m.placeholderBuilding}
            </option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {m.buildingLabel(b.name)}
              </option>
            ))}
          </Select>
          {buildings.length === 0 && phaseId && (
            <p className="mt-1 text-xs text-slate-500">
              {m.noBuildingsHint}
            </p>
          )}
        </Field>
      </div>

      {!projectId && (
        <p className="text-xs text-slate-500">
          {m.projectFirstHint}
        </p>
      )}
    </div>
  );
}
