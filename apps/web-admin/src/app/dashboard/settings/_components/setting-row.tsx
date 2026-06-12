'use client';

import { useState } from 'react';
import { Pencil, Lock, Check, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { patchSettingAction } from '../actions';

interface Props {
  settingKey: string;
  label: string;
  hasLabel: boolean;
  type: 'نص' | 'رقم' | 'منطقي' | 'JSON';
  typeCls: string;
  preview: string;
  sensitive: boolean;
  updatedAt: string;
}

/* ── Value display — prominent, no input styling ───────────────────────────── */

function ValueDisplay({ type, preview, sensitive }: Pick<Props, 'type' | 'preview' | 'sensitive'>) {
  if (sensitive) {
    return (
      <span className="font-mono text-lg text-amber-600 tracking-[0.35em] select-none leading-none">
        ••••••
      </span>
    );
  }

  if (type === 'منطقي') {
    const on = preview === 'true';
    return on ? (
      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-teal-50 text-teal-700 border border-teal-100">
        <Check className="h-4 w-4 shrink-0" />
        مفعّل
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <XIcon className="h-4 w-4 shrink-0" />
        غير مفعّل
      </span>
    );
  }

  if (type === 'رقم') {
    return (
      <span className="text-[28px] font-bold text-slate-800 tabular-nums leading-none" dir="ltr">
        {preview}
      </span>
    );
  }

  if (type === 'JSON') {
    const short = preview.replace(/\s+/g, ' ').slice(0, 80);
    return (
      <div className="space-y-1.5 w-full">
        <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold tracking-widest uppercase">
          JSON
        </span>
        <p className="font-mono text-[11px] text-slate-500 line-clamp-2 leading-relaxed" dir="ltr">
          {short}
        </p>
      </div>
    );
  }

  /* نص — dir="auto" handles Arabic + Latin naturally */
  return (
    <p className="text-sm text-slate-700 leading-relaxed line-clamp-2" dir="auto">
      {preview}
    </p>
  );
}

/* ── Type-appropriate edit input ───────────────────────────────────────────── */

function EditInput({ type, preview, sensitive }: Pick<Props, 'type' | 'preview' | 'sensitive'>) {
  if (type === 'منطقي') {
    return (
      <Select name="value" defaultValue={preview === 'true' ? 'true' : 'false'} required>
        <option value="true">نعم (مفعّل)</option>
        <option value="false">لا (غير مفعّل)</option>
      </Select>
    );
  }
  if (type === 'رقم') {
    return (
      <Input
        name="value"
        type="number"
        step="any"
        dir="ltr"
        defaultValue={sensitive ? '' : preview}
        placeholder={sensitive ? 'أدخل قيمة رقمية' : preview}
        required
      />
    );
  }
  if (type === 'JSON') {
    return (
      <Textarea
        name="value"
        rows={3}
        dir="ltr"
        defaultValue={sensitive ? '' : preview}
        placeholder={sensitive ? 'أدخل JSON جديد' : undefined}
        className="text-xs font-mono resize-none"
        required
      />
    );
  }
  return (
    <Input
      name="value"
      dir="ltr"
      defaultValue={sensitive ? '' : preview}
      placeholder={sensitive ? 'أدخل القيمة الجديدة' : preview}
      required
    />
  );
}

/* ── Setting card — vertical, premium configuration card ───────────────────── */

export function SettingCard({
  settingKey,
  label,
  hasLabel,
  type,
  typeCls,
  preview,
  sensitive,
  updatedAt,
}: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface flex flex-col min-h-[168px] p-4',
        'transition-all duration-150',
        editing
          ? 'border-brand-200 shadow-md'
          : 'border-hairline shadow-xs hover:shadow-sm hover:border-slate-200',
      )}
    >
      {/* ── Top: Arabic label + type badge + edit icon ──────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 min-w-0 text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
          {hasLabel ? label : settingKey}
        </p>

        <div className="flex items-center gap-1.5 shrink-0 mt-px">
          <span className={cn('text-[10px] font-semibold px-1.5 py-px rounded', typeCls)}>
            {type}
          </span>
          {/* Icon-only edit/close toggle */}
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? 'إلغاء' : 'تعديل الإعداد'}
            title={editing ? 'إلغاء' : 'تعديل'}
            className={cn(
              'inline-flex items-center justify-center h-6 w-6 rounded-lg transition-colors',
              editing
                ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50',
            )}
          >
            {editing
              ? <XIcon className="h-3.5 w-3.5" />
              : <Pencil className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>

      {/* ── Middle: value (view) or edit form (edit) ─────────────────────── */}
      <div className="flex-1 flex items-center py-4">
        {editing ? (
          <form action={patchSettingAction} className="w-full space-y-2.5">
            <input type="hidden" name="key" value={settingKey} />

            {/* Current value hint */}
            {!sensitive && (
              <p className="text-[11px] text-slate-500">
                الحالية:{' '}
                <span className="font-medium text-slate-700">
                  {type === 'منطقي'
                    ? (preview === 'true' ? 'مفعّل' : 'غير مفعّل')
                    : preview.slice(0, 40)}
                </span>
              </p>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 block">القيمة الجديدة</label>
              <EditInput type={type} preview={preview} sensitive={sensitive} />
            </div>

            <div className="flex items-center gap-1.5">
              <Button type="submit" size="sm" variant="primary">حفظ</Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                إلغاء
              </Button>
            </div>
          </form>
        ) : (
          <ValueDisplay type={type} preview={preview} sensitive={sensitive} />
        )}
      </div>

      {/* ── Bottom: technical key + sensitive lock + updated date ───────── */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-hairline">
        <p className="font-mono text-[11px] text-slate-400 truncate min-w-0" dir="ltr">
          {settingKey}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {sensitive && <Lock className="h-3 w-3 text-amber-400" />}
          <p className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">{updatedAt}</p>
        </div>
      </div>
    </div>
  );
}
