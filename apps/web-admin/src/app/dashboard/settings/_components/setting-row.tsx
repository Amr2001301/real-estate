'use client';

import { useState } from 'react';
import { Pencil, Lock, Check, X as XIcon } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { patchSettingAction } from '../actions';

export type SettingType = 'text' | 'number' | 'boolean' | 'json' | 'enum';

interface Props {
  settingKey: string;
  label: string;
  type: SettingType;
  /** An enum setting's choices, each with its name. */
  options?: Array<{ value: string; label: string }>;
  preview: string;
  sensitive: boolean;
  /** Nothing in the system reads this key (F7). */
  unused?: boolean;
  /** "Last changed 2 days ago". */
  updated: string;
  locale?: Locale;
}

type Sr = ReturnType<typeof uiT>['settingRow'];

/* ── Value display ─────────────────────────────────────────────────────────── */

function ValueDisplay({ type, preview, sensitive, options, sr }: Pick<Props, 'type' | 'preview' | 'sensitive' | 'options'> & { sr: Sr }) {
  if (sensitive) {
    return (
      <span className="inline-flex items-center gap-2 text-amber-600">
        <Lock className="h-3.5 w-3.5" />
        <span className="font-mono tracking-[0.3em]">••••••</span>
      </span>
    );
  }
  if (type === 'boolean') {
    const on = preview === 'true';
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold',
          on ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/10 text-slate-500',
        )}
      >
        {on ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
        {on ? sr.enabled : sr.disabled}
      </span>
    );
  }
  if (type === 'enum') {
    const label = options?.find((o) => o.value === preview)?.label ?? preview;
    return (
      <span className="inline-flex items-center rounded-full bg-brand-500/12 px-3 py-1 text-[12px] font-semibold text-brand-700">
        {label}
      </span>
    );
  }
  if (type === 'number') {
    return <span className="num text-[24px] font-semibold leading-none text-slate-900" dir="ltr">{preview}</span>;
  }
  if (type === 'json') {
    return (
      <span className="block max-w-[260px] truncate font-mono text-[11.5px] text-slate-500" dir="ltr" title={preview}>
        {preview.replace(/\s+/g, ' ')}
      </span>
    );
  }
  return (
    <span className="block max-w-[260px] truncate text-[13px] font-medium text-slate-800" dir="auto" title={preview}>
      {preview}
    </span>
  );
}

/* ── Type-appropriate edit input ───────────────────────────────────────────── */

function EditInput({ type, preview, sensitive, options, sr }: Pick<Props, 'type' | 'preview' | 'sensitive' | 'options'> & { sr: Sr }) {
  if (type === 'boolean') {
    return (
      <Select name="value" defaultValue={preview === 'true' ? 'true' : 'false'} required>
        <option value="true">{sr.yesEnabled}</option>
        <option value="false">{sr.noDisabled}</option>
      </Select>
    );
  }
  if (type === 'enum' && options) {
    return (
      <Select name="value" defaultValue={preview} required>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    );
  }
  if (type === 'number') {
    return (
      <Input
        name="value"
        type="number"
        step="any"
        dir="ltr"
        defaultValue={sensitive ? '' : preview}
        placeholder={sensitive ? sr.enterNumber : preview}
        required
      />
    );
  }
  if (type === 'json') {
    return (
      <Textarea
        name="value"
        rows={3}
        dir="ltr"
        defaultValue={sensitive ? '' : preview}
        placeholder={sensitive ? sr.enterJson : undefined}
        className="resize-none font-mono text-xs"
        required
      />
    );
  }
  return (
    <Input
      name="value"
      dir="ltr"
      defaultValue={sensitive ? '' : preview}
      placeholder={sensitive ? sr.enterValue : preview}
      required
    />
  );
}

/* ── Setting row ───────────────────────────────────────────────────────────── */

export function SettingRow({
  settingKey,
  label,
  type,
  options,
  preview,
  sensitive,
  unused = false,
  updated,
  locale = 'ar',
}: Props) {
  const [editing, setEditing] = useState(false);
  const sr = uiT(locale).settingRow;
  const ps = uiT(locale).pages.settings;

  return (
    <li data-testid="setting-row" className={cn('px-6 py-4 transition-colors', editing ? 'bg-brand-500/[0.04]' : 'hover:bg-surface-muted/40')}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-slate-900" title={settingKey}>{label}</p>
            {unused && (
              <span
                data-testid="setting-unused"
                title={ps.unusedHint}
                className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-bold text-slate-500"
              >
                {ps.unusedBadge}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11.5px] text-slate-400">{updated}</p>
        </div>

        {!editing && (
          <div className="shrink-0">
            <ValueDisplay type={type} preview={preview} sensitive={sensitive} options={options} sr={sr} />
          </div>
        )}

        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-label={editing ? sr.cancelBtn : sr.editAriaLabel}
          title={editing ? sr.cancelBtn : sr.editAriaLabel}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
            editing
              ? 'border-hairline text-slate-500 hover:text-slate-700'
              : 'border-hairline text-slate-400 hover:border-brand-500/40 hover:text-brand-600',
          )}
        >
          {editing ? <XIcon className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
      </div>

      {editing && (
        <form action={patchSettingAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="key" value={settingKey} />
          <div className="min-w-[220px] flex-1 space-y-1">
            <label className="block text-[12px] font-semibold text-slate-700">{sr.newValueLabel}</label>
            <EditInput type={type} preview={preview} sensitive={sensitive} options={options} sr={sr} />
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="submit" size="sm" variant="primary">{sr.saveBtn}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {sr.cancelBtn}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
