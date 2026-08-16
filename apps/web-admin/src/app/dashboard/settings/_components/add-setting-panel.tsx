'use client';

import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { patchSettingAction } from '../actions';

type FieldType = 'text' | 'number' | 'boolean' | 'json';

interface Template {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

const TEMPLATE_CONFIGS: { key: string; type: FieldType; placeholder?: string }[] = [
  { key: 'company.name',                 type: 'text',    placeholder: 'ديفورا للتطوير العقاري' },
  { key: 'company.email',                type: 'text',    placeholder: 'info@company.sa' },
  { key: 'company.phone',                type: 'text',    placeholder: '+966 11 000 0000' },
  { key: 'company.address',              type: 'text',    placeholder: 'الرياض، المملكة العربية السعودية' },
  { key: 'company.website',              type: 'text',    placeholder: 'https://company.sa' },
  { key: 'company.vatNumber',            type: 'text',    placeholder: '300000000000003' },
  { key: 'broker.defaultCommissionPct',  type: 'number',  placeholder: '2.5' },
  { key: 'broker.payoutCycleDays',       type: 'number',  placeholder: '30' },
  { key: 'broker.minPayoutAmount',       type: 'number',  placeholder: '1000' },
  { key: 'broker.autoApproveLeads',      type: 'boolean' },
  { key: 'sales.leadExpireDays',         type: 'number',  placeholder: '90' },
  { key: 'sales.reservationExpireDays',  type: 'number',  placeholder: '7' },
  { key: 'sales.allowMultiReservation',  type: 'boolean' },
  { key: 'notifications.emailEnabled',   type: 'boolean' },
  { key: 'notifications.smsEnabled',     type: 'boolean' },
  { key: 'notifications.fromEmail',      type: 'text',    placeholder: 'noreply@company.sa' },
  { key: 'reports.currency',             type: 'text',    placeholder: 'SAR' },
  { key: 'reports.dateFormat',           type: 'text',    placeholder: 'DD/MM/YYYY' },
  { key: 'reports.timezone',             type: 'text',    placeholder: 'Asia/Riyadh' },
  { key: 'security.maxLoginAttempts',    type: 'number',  placeholder: '5' },
  { key: 'security.sessionTimeoutMins',  type: 'number',  placeholder: '60' },
  { key: 'security.requireMfa',          type: 'boolean' },
];

const CUSTOM_KEY = '__custom__';

export function AddSettingPanel({ locale = 'ar' }: { locale?: Locale }) {
  const m = uiT(locale).pages.settings.addPanel;
  const [open, setOpen]             = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [customKey, setCustomKey]   = useState('');

  const templates: Template[] = TEMPLATE_CONFIGS.map((c) => ({
    ...c,
    label: m.templateLabels[c.key] ?? c.key,
  }));

  const template   = templates.find((t) => t.key === selectedKey);
  const isCustom   = selectedKey === CUSTOM_KEY;
  const resolvedKey = isCustom ? customKey.trim() : (template?.key ?? '');

  function handleClose() {
    setOpen(false);
    setSelectedKey('');
    setCustomKey('');
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
              {templates.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
              <option value={CUSTOM_KEY}>{m.customOption}</option>
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

          {/* ── Custom key — shown for custom option only ─────────────── */}
          {isCustom && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">
                {m.fieldCustomKey}
              </label>
              <Input
                placeholder="group.fieldName"
                dir="ltr"
                value={customKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomKey(e.target.value)}
              />
              <p className="text-2xs text-slate-400">
                {m.customKeyHintFormat}{' '}
                <span className="font-mono" dir="ltr">group.fieldName</span>
                {' '}— {m.customKeyHintExample}{' '}
                <span className="font-mono" dir="ltr">company.logoUrl</span>
              </p>
            </div>
          )}

          {/* ── Value input — type-aware ──────────────────────────────── */}
          {(template || isCustom) && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">{m.fieldValue}</label>

              {template?.type === 'boolean' ? (
                <Select name="value" required>
                  <option value="">{m.boolPlaceholder}</option>
                  <option value="true">{m.boolTrue}</option>
                  <option value="false">{m.boolFalse}</option>
                </Select>
              ) : template?.type === 'number' ? (
                <Input
                  name="value"
                  type="number"
                  step="any"
                  dir="ltr"
                  placeholder={template.placeholder ?? '0'}
                  required
                />
              ) : template?.type === 'json' || isCustom ? (
                <Textarea
                  name="value"
                  rows={3}
                  dir="ltr"
                  placeholder={isCustom ? m.jsonPlaceholder : ''}
                  className="text-xs font-mono resize-none"
                  required
                />
              ) : (
                <Input
                  name="value"
                  dir="ltr"
                  placeholder={template?.placeholder ?? ''}
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
