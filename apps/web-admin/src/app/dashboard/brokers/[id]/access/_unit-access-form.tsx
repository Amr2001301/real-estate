'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/form/field';
import type { Project, Unit } from '@/lib/types';
import { tx } from '@/lib/format';

interface Props {
  /** Server action — `grantUnit(formData)` bound to the broker id. */
  action: (formData: FormData) => void | Promise<void>;
  allUnits: Unit[];
  projects: Project[];
}

/**
 * Project-first unit access form (Phase 18A). Defaults to AVAILABLE units;
 * RESERVED / SOLD are filtered out client-side AND refused by the backend
 * (see `assertUnitGrantable` in BrokerAccessService). An "include
 * non-available" toggle exists for visibility, but those units are still
 * non-selectable.
 */
export function UnitAccessGrantForm({ action, allUnits, projects }: Props) {
  const [projectId, setProjectId] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Map each unit to the projectId via its building.phase.project. Units
  // without the joined data fall through into "OTHER" and stay hidden until
  // a matching project is picked.
  const unitsForProject = useMemo(() => {
    if (!projectId) return [];
    return allUnits.filter((u) => u.building?.phase?.projectId === projectId);
  }, [projectId, allUnits]);

  const selectable = useMemo(
    () => unitsForProject.filter((u) => u.status === 'AVAILABLE'),
    [unitsForProject],
  );
  const blocked = useMemo(
    () => unitsForProject.filter((u) => u.status !== 'AVAILABLE'),
    [unitsForProject],
  );

  const shownUnits = showAll ? unitsForProject : selectable;

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <Field label="المشروع" name="_project" required>
        <Select
          id="_project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
        >
          <option value="" disabled>اختر مشروعًا</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}{p.city ? ` — ${p.city}` : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="الوحدة" name="unitId" required>
        <Select id="unitId" name="unitId" required defaultValue="" disabled={!projectId}>
          <option value="" disabled>
            {projectId ? (selectable.length > 0 ? 'اختر وحدة متاحة' : 'لا توجد وحدات متاحة') : 'اختر مشروعًا أولًا'}
          </option>
          {shownUnits.map((u) => (
            <option key={u.id} value={u.id} disabled={u.status !== 'AVAILABLE'}>
              {u.code} — {u.type}{u.building?.name ? ` (${u.building.name})` : ''}
              {u.status !== 'AVAILABLE' ? ` — ${u.status}` : ''}
            </option>
          ))}
        </Select>
      </Field>

      <div className="md:col-span-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
        <label className="inline-flex items-center gap-2">
          <Checkbox name="active" defaultChecked />
          <span>مفعّل</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <Checkbox checked={showAll} onChange={(e) => setShowAll(e.currentTarget.checked)} />
          <span>إظهار الوحدات غير المتاحة (للعرض فقط)</span>
        </label>
        {blocked.length > 0 && !showAll && (
          <span className="text-2xs text-slate-500">
            {blocked.length} وحدة محجوزة/مباعة مخفية. لا يمكن منحها كصلاحية وصول.
          </span>
        )}
      </div>

      <div className="md:col-span-12 flex justify-end">
        <Button type="submit" variant="primary" size="md">
          منح الصلاحية
        </Button>
      </div>
    </form>
  );
}
