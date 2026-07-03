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

/* ── Value display ─────────────────────────────────────────────────────────── */

function ValueDisplay({ type, preview, sensitive }: Pick<Props, 'type' | 'preview' | 'sensitive'>) {
  if (sensitive) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 shrink-0">
          <Lock className="h-3.5 w-3.5 text-amber-600" />
        </span>
        <span className="font-mono text-base text-amber-500 tracking-[0.3em] select-none">
          ••••••
        </span>
      </div>
    );
  }

  if (type === 'منطقي') {
    const on = preview === 'true';
    return on ? (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[13px] font-semibold bg-teal-50 text-teal-700 border border-teal-100">
        <Check className="h-3.5 w-3.5 shrink-0" />
        مفعّل
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[13px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <XIcon className="h-3.5 w-3.5 shrink-0" />
        غير مفعّل
      </span>
    );
  }

  if (type === 'رقم') {
    return (
      <span className="text-[30px] font-black text-slate-800 tabular-nums leading-none" dir="ltr">
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

  /* نص */
  return (
    <p className="text-[13px] text-slate-700 leading-relaxed line-clamp-2" dir="auto">
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

/* ── Setting card ──────────────────────────────────────────────────────────── */

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
        'rounded-2xl border flex flex-col min-h-[176px] p-4 transition-all duration-150',
        editing
          ? 'border-brand-200 bg-surface shadow-md'
          : sensitive
            ? 'border-amber-100 bg-amber-50/20 shadow-xs hover:shadow-sm hover:border-amber-200'
            : 'border-hairline bg-surface shadow-xs hover:shadow-sm hover:border-slate-200',
      )}
    >
      {/* ── Top: label + type badge + edit toggle ──────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 min-w-0 text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2">
          {hasLabel ? label : settingKey}
        </p>

        <div className="flex items-center gap-1.5 shrink-0 mt-px">
          {/* Type badge */}
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
            typeCls,
          )}>
            {type}
          </span>

          {/* Edit / close toggle */}
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? 'إلغاء' : 'تعديل الإعداد'}
            title={editing ? 'إلغاء' : 'تعديل'}
            className={cn(
              'inline-flex items-center justify-center h-6 w-6 rounded-lg transition-colors shrink-0',
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

      {/* ── Middle: value (view) or edit form ──────────────────────────── */}
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
              <label className="text-[12px] font-semibold text-slate-800 block">القيمة الجديدة</label>
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

      {/* ── Bottom: technical key + lock + updated date ─────────────────── */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-hairline">
        <p
          className="font-mono text-[11px] text-slate-400 truncate min-w-0"
          dir="ltr"
          title={settingKey}
        >
          {settingKey}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {sensitive && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-50">
              <Lock className="h-2.5 w-2.5 text-amber-500" />
            </span>
          )}
          <p className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">{updatedAt}</p>
        </div>
      </div>
    </div>
  );
}
