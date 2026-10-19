'use client';

import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { patchSettingAction } from '../actions';
import { KNOWN_SETTINGS } from './known-settings';

/**
 * Adds one of the settings the system reads and the company does not have
 * yet (the defaults are seeded per company, so this is mostly the discount
 * cap). Free-form keys are gone: nothing read them.
 */
export function AddSettingPanel({
  locale = 'ar',
  existingKeys,
}: {
  locale?: Locale;
  existingKeys: string[];
}) {
  const t = uiT(locale).pages.settings;
  const m = t.addPanel;
  const [open, setOpen]             = useState(false);
  const [selectedKey, setSelectedKey] = useState('');

  const have = new Set(existingKeys);
  const templates = KNOWN_SETTINGS.filter((s) => !have.has(s.key)).map((s) => ({
    ...s,
    label: t.keyLabels[s.key] ?? s.key,
  }));
  if (templates.length === 0) return null;

  const template    = templates.find((x) => x.key === selectedKey);
  const resolvedKey = template?.key ?? '';

  function handleClose() {
    setOpen(false);
    setSelectedKey('');
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        {m.btnLabel}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title={m.dialogTitle}
        description={m.dialogDesc}
        size="sm"
      >
        <form action={patchSettingAction} className="space-y-4">
          <input type="hidden" name="key" value={resolvedKey} />

          {/* ── Template selector ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 block">
              {m.fieldType}
            </label>
            <Select
              value={selectedKey}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedKey(e.target.value)}
              required
            >
              <option value="" disabled>{m.selectPlaceholder}</option>
              {templates.map((x) => (
                <option key={x.key} value={x.key}>{x.label}</option>
              ))}
            </Select>

            {/* Technical key chip — shown after template selection */}
            {template && (
              <p className="text-2xs text-slate-400">
                {m.techKeyPrefix}{' '}
                <span
                  className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
                  dir="ltr"
                >
                  {template.key}
                </span>
              </p>
            )}
          </div>

          {/* ── Value input — type-aware ──────────────────────────────── */}
          {template && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">{m.fieldValue}</label>

              {template.type === 'boolean' ? (
                <Select name="value" required>
                  <option value="">{m.boolPlaceholder}</option>
                  <option value="true">{m.boolTrue}</option>
                  <option value="false">{m.boolFalse}</option>
                </Select>
              ) : template.type === 'enum' ? (
                <Select name="value" required dir="ltr">
                  {template.options!.map((o) => (
                    // A bare string stays a string through the action's JSON.parse fallback.
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  name="value"
                  type={template.type === 'number' ? 'number' : 'text'}
                  step="any"
                  dir="ltr"
                  placeholder={template.placeholder ?? ''}
                  required
                />
              )}
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              {m.btnCancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!resolvedKey}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              {m.btnSave}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
