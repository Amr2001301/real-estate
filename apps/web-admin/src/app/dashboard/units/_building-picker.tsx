'use client';

import { useEffect, useState } from 'react';
import type { Project, Phase, Building } from '@/lib/types';
import { inputClass } from '@/components/form/field';

interface Props {
  projects: Project[];
  initialBuildingId?: string;
}

interface PhaseWithBuildings extends Phase {
  buildings?: Building[];
}

interface ProjectWithPhases extends Project {
  phases?: PhaseWithBuildings[];
}

export function BuildingPicker({ projects, initialBuildingId }: Props) {
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [buildingId, setBuildingId] = useState(initialBuildingId ?? '');
  const [details, setDetails] = useState<ProjectWithPhases | null>(null);
  const [loading, setLoading] = useState(false);

  // If we have an initial building, find the project that contains it.
  useEffect(() => {
    if (!initialBuildingId) return;
    (async () => {
      for (const p of projects) {
        const res = await fetch(`/api-proxy/projects/${p.id}`, { credentials: 'include' });
        if (!res.ok) continue;
        const project = (await res.json()) as ProjectWithPhases;
        for (const ph of project.phases ?? []) {
          for (const b of ph.buildings ?? []) {
            if (b.id === initialBuildingId) {
              setProjectId(p.id);
              setPhaseId(ph.id);
              setDetails(project);
              return;
            }
          }
        }
      }
    })();
  }, [initialBuildingId, projects]);

  // Fetch project details when changed
  useEffect(() => {
    if (!projectId) {
      setDetails(null);
      return;
    }
    setLoading(true);
    fetch(`/api-proxy/projects/${projectId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: ProjectWithPhases) => setDetails(d))
      .finally(() => setLoading(false));
  }, [projectId]);

  const phases = details?.phases ?? [];
  const buildings = phases.find((ph) => ph.id === phaseId)?.buildings ?? [];

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-gray-700">المبنى</legend>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">المشروع</label>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setPhaseId('');
              setBuildingId('');
            }}
            className={inputClass}
          >
            <option value="">اختر مشروعًا…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name?.ar ?? p.name?.en ?? p.city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">المرحلة</label>
          <select
            value={phaseId}
            onChange={(e) => {
              setPhaseId(e.target.value);
              setBuildingId('');
            }}
            disabled={!projectId || loading}
            className={inputClass}
          >
            <option value="">اختر مرحلة…</option>
            {phases.map((ph) => (
              <option key={ph.id} value={ph.id}>
                {ph.name?.ar ?? ph.name?.en}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">المبنى</label>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            required
            disabled={!phaseId}
            name="buildingId"
            className={inputClass}
          >
            <option value="">اختر مبنى…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!projectId && (
        <p className="text-xs text-gray-500">
          يجب اختيار المشروع، ثم المرحلة، ثم المبنى. إذا لم تكن لديك مراحل/مباني فأنشئها من صفحة المشروع.
        </p>
      )}
    </fieldset>
  );
}
