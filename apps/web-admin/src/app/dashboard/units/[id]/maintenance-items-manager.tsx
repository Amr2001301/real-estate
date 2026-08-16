'use client';

import { useState, useTransition } from 'react';
import { Check, AlertCircle, Loader2, ShieldCheck, ShieldOff, Clock } from 'lucide-react';
import type { MaintenanceCategory, UnitMaintenanceItem } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { tx, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { selectCategoryAction, setMaintenanceItemActiveAction } from './maintenance-items-actions';

// One card per active maintenance category. A category is "selected" when the
// unit has an active UnitMaintenanceItem for it. Warranty starts automatically
// on contract signing — there are no manual warranty/supplier fields here.
export function MaintenanceItemsManager({
  unitId,
  items,
  categories,
  locale = 'ar',
}: {
  unitId: string;
  items: UnitMaintenanceItem[];
  categories: MaintenanceCategory[];
  locale?: Locale;
}) {
  const m = uiT(locale).pages.units.maintenanceCard;
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const itemByCategory = new Map<string, UnitMaintenanceItem>();
  for (const it of items) if (it.categoryId) itemByCategory.set(it.categoryId, it);

  function run(categoryId: string, fn: () => Promise<{ error?: string; ok?: boolean }>) {
    setError(null);
    setPendingId(categoryId);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      setPendingId(null);
    });
  }

  function toggle(cat: MaintenanceCategory) {
    const item = itemByCategory.get(cat.id);
    if (item?.active) {
      // Unselect — backend rejects if the warranty already started.
      run(cat.id, () => setMaintenanceItemActiveAction(unitId, item.id, false));
    } else if (item) {
      // Reactivate an existing (inactive) item.
      run(cat.id, () => setMaintenanceItemActiveAction(unitId, item.id, true));
    } else {
      run(cat.id, () => selectCategoryAction(unitId, cat.id, cat.name.ar, cat.name.en));
    }
  }

  if (categories.length === 0) {
    return <p className="text-sm text-slate-500">{m.emptyCategories}</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-2.5 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const item = itemByCategory.get(cat.id);
          const selected = !!item?.active;
          const warrantyStarted = !!item?.warrantyStart;
          const busy = pendingId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat)}
              disabled={busy || (selected && warrantyStarted)}
              className={cn(
                'relative text-start rounded-xl border p-3.5 transition-colors',
                selected
                  ? 'border-brand-300 bg-brand-50/60 ring-1 ring-inset ring-brand-200'
                  : 'border-hairline bg-surface hover:bg-surface-muted/50',
                (busy || (selected && warrantyStarted)) && 'cursor-not-allowed opacity-80',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{tx(cat.name)}</span>
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                    selected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 text-transparent',
                  )}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin text-brand-600" /> : <Check className="h-3 w-3" />}
                </span>
              </div>
              <div className="mt-2 text-[11px]">
                {!selected ? (
                  <span className="text-slate-400">{m.statusNotSelected}</span>
                ) : !warrantyStarted ? (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock className="h-3 w-3" /> {m.statusWarrantyNotStarted}
                  </span>
                ) : item!.warrantyStatus === 'IN_WARRANTY' ? (
                  <span className="inline-flex items-center gap-1 text-success-700">
                    <ShieldCheck className="h-3 w-3" />
                    {item!.warrantyEnd ? m.statusUnderWarrantyUntil(formatDate(item!.warrantyEnd)) : m.statusUnderWarranty}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger-600">
                    <ShieldOff className="h-3 w-3" /> {m.statusOutOfWarranty}
                  </span>
                )}
              </div>
              {selected && warrantyStarted && (
                <p className="mt-1 text-[10px] text-slate-400">{m.warrantyStartedNote}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
