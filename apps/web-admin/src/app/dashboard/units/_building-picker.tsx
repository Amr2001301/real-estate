'use client';

import { useEffect, useState } from 'react';
import type { Project, Phase, Building } from '@/lib/types';
import { Field } from '@/components/form/field';
import { Select } from '@/components/ui/select';

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
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="المشروع" name="project" required>
          <Select
            id="project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setPhaseId('');
              setBuildingId('');
            }}
          >
            <option value="">اختر مشروعًا…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name?.ar ?? p.name?.en ?? p.city}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="المرحلة" name="phase" required>
          <Select
            id="phase"
            value={phaseId}
            onChange={(e) => {
              setPhaseId(e.target.value);
              setBuildingId('');
            }}
            disabled={!projectId || loading}
          >
            <option value="">اختر مرحلة…</option>
            {phases.map((ph) => (
              <option key={ph.id} value={ph.id}>
                {ph.name?.ar ?? ph.name?.en}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="المبنى" name="buildingId" required>
          <Select
            id="buildingId"
            name="buildingId"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            required
            disabled={!phaseId}
          >
            <option value="">اختر مبنى…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                مبنى {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {!projectId && (
        <p className="text-xs text-slate-500">
          يجب اختيار المشروع، ثم المرحلة، ثم المبنى. إذا لم تكن لديك مراحل أو مبانٍ بعد، يمكنك
          إنشاؤها من صفحة المشروع.
        </p>
      )}
    </div>
  );
}
