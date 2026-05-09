'use client';

import { useMemo, useState } from 'react';
import { Building2, Check, Plus, X } from 'lucide-react';
import type { Translatable } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SERVICE_PRESETS } from './services-preset';

interface Props {
  /** Field name for the hidden input that the server action reads. */
  name?: string;
  defaultValue?: Translatable[];
}

interface DisplayItem {
  ar: string;
  en: string;
  /** Whether this entry comes from the curated preset list (used for icon). */
  isPreset: boolean;
}

export function ServiceTilePicker({
  name = 'services',
  defaultValue = [],
}: Props) {
  const initial = useMemo<DisplayItem[]>(() => {
    return SERVICE_PRESETS.map((p) => ({ ar: p.ar, en: p.en, isPreset: true }))
      .map((p) => ({
        ...p,
        // No selection state encoded here; presets always render as tiles.
      }))
      .concat(
        defaultValue
          .filter((v) => !SERVICE_PRESETS.some((p) => p.ar === v.ar))
          .map((v) => ({ ar: v.ar, en: v.en, isPreset: false })),
      );
  }, [defaultValue]);

  // Selected = the actual services that will be saved.
  const [selected, setSelected] = useState<Translatable[]>(() =>
    defaultValue.map((v) => ({ ar: v.ar, en: v.en })),
  );
  // Custom items appended by the user during this session.
  const [extras, setExtras] = useState<DisplayItem[]>([]);

  // Custom add form state.
  const [customAr, setCustomAr] = useState('');
  const [customEn, setCustomEn] = useState('');

  const tiles: DisplayItem[] = [...initial, ...extras];

  const isSelected = (ar: string) => selected.some((s) => s.ar === ar);

  function toggle(item: DisplayItem) {
    setSelected((prev) =>
      prev.some((s) => s.ar === item.ar)
        ? prev.filter((s) => s.ar !== item.ar)
        : [...prev, { ar: item.ar, en: item.en }],
    );
  }

  function addCustom() {
    const ar = customAr.trim();
    const en = customEn.trim();
    if (!ar || !en) return;
    if (tiles.some((t) => t.ar === ar)) return;
    const item: DisplayItem = { ar, en, isPreset: false };
    setExtras((prev) => [...prev, item]);
    setSelected((prev) => [...prev, { ar, en }]);
    setCustomAr('');
    setCustomEn('');
  }

  function removeCustom(item: DisplayItem) {
    setExtras((prev) => prev.filter((x) => x.ar !== item.ar));
    setSelected((prev) => prev.filter((s) => s.ar !== item.ar));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden field that the server action's `parseTranslatableJson` reads. */}
      <input type="hidden" name={name} value={JSON.stringify(selected)} readOnly />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {tiles.map((tile) => {
          const preset = SERVICE_PRESETS.find((p) => p.ar === tile.ar);
          const Icon = preset?.icon ?? Building2;
          const active = isSelected(tile.ar);
          return (
            <button
              key={tile.ar}
              type="button"
              onClick={() => toggle(tile)}
              aria-pressed={active}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-start transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                active
                  ? 'border-brand-500 bg-brand-50/70 text-brand-800'
                  : 'border-hairline bg-surface hover:border-slate-300 text-slate-700',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                  active
                    ? 'bg-brand-500 text-white'
                    : 'bg-info-50 text-slate-500',
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <span className="flex-1 text-xs font-semibold leading-snug">
                {tile.ar}
              </span>
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-md ring-1 shrink-0',
                  active
                    ? 'bg-brand-600 ring-brand-600 text-white'
                    : 'bg-surface ring-hairline text-transparent',
                )}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>

              {!tile.isPreset && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustom(tile);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      removeCustom(tile);
                    }
                  }}
                  className="absolute -top-1.5 -end-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm cursor-pointer"
                  aria-label="حذف"
                >
                  <X className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-hairline pt-4">
        <p className="text-xs font-medium text-slate-500 mb-2">
          إضافة خدمة مخصصة
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            inputSize="sm"
            placeholder="بالعربية"
            dir="rtl"
            value={customAr}
            onChange={(e) => setCustomAr(e.target.value)}
          />
          <Input
            inputSize="sm"
            placeholder="English"
            dir="ltr"
            value={customEn}
            onChange={(e) => setCustomEn(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            disabled={!customAr.trim() || !customEn.trim()}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            إضافة
          </Button>
        </div>
      </div>
    </div>
  );
}
