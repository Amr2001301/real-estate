'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchSelect } from '@/components/form/search-select';
import type { Project, Unit } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { tx } from '@/lib/format';
import { uiT } from '@/messages/ui';

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  projects: Project[];
  locale?: Locale;
}

// Units are searched on the server, inside the chosen project. This form used
// to filter one ?pageSize=500 fetch of every unit in the company, so in a
// large company whole projects had no units to grant.
export function UnitAccessGrantForm({ action, projects, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.brokerAccessPage;
  const [projectId, setProjectId] = useState('');
  const [showAll, setShowAll] = useState(false);

  const endpoint = `/api-proxy/units?projectId=${encodeURIComponent(projectId)}${
    showAll ? '' : '&status=AVAILABLE'
  }`;

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label={m.unitProject}>
        <Select
          id="_project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
        >
          <option value="" disabled>{m.unitProjectPlaceholder}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}{p.city ? ` — ${p.city}` : ''}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={m.unitLabel}>
        {/* Keyed by project and filter: either change clears the unit. */}
        <SearchSelect<Unit>
          key={`${projectId}:${showAll}`}
          name="unitId"
          required
          disabled={!projectId}
          endpoint={endpoint}
          toOption={(u) => ({
            id: u.id,
            label: `${u.code} — ${u.type}${u.building?.name ? ` (${u.building.name})` : ''}${
              u.status !== 'AVAILABLE' ? ` — ${u.status}` : ''
            }`,
            raw: u,
            // Unavailable units are listed for reference only.
            disabled: u.status !== 'AVAILABLE',
          })}
          placeholder={projectId ? uiT(locale).common.searchUnitPlaceholder : m.unitSelectProjectFirst}
          locale={locale}
        />
      </FormField>

      {/* Checkboxes + submit on the same row */}
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-hairline">
        <div className="flex flex-wrap items-center gap-5">
          <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
            <Checkbox name="active" defaultChecked />
            <span>{m.activeLabel}</span>
          </label>
          <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
            <Checkbox
              checked={showAll}
              onChange={(e) => setShowAll(e.currentTarget.checked)}
            />
            <span>{m.showUnavailableLabel}</span>
          </label>
        </div>
        <Button type="submit" variant="primary" size="md">{m.btnGrantUnit}</Button>
      </div>
    </form>
  );
}
