'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Award, TrendingUp, Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Target } from 'lucide-react';
import { TargetFormDialog, type SalesUser, type SalesTarget } from './target-form-dialog';
import {
  fmtAmt,
  num,
  pctLabel,
  pctBarColor,
  pctTextColor,
  periodLabel,
} from './utils';

export interface PerformanceRow {
  salesId: string;
  period: string;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
  targetUnitsPercent: number | null;
}

interface Props {
  canManage: boolean;
  salesUsers: SalesUser[];
  targets: SalesTarget[];
  perfRows: PerformanceRow[];
  hasFilters: boolean;
  error?: string;
  symbol?: string;
}

// ── Inline sub-components ──────────────────────────────────────────────────

function PerfBadge({ pct }: { pct: number | null }) {
  if (pct === null)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium bg-slate-100 text-slate-400">
        لا يوجد أداء بعد
      </span>
    );
  if (pct >= 100)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
        متقدم
      </span>
    );
  if (pct >= 75)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        على المسار
      </span>
    );
  if (pct >= 50)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
        يحتاج دعم
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
      يحتاج متابعة
    </span>
  );
}

function PctCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-300 text-xs">—</span>;
  const display = pct > 999 ? '+999%' : `${pct}%`;
  return (
    <div className="flex flex-col gap-1 min-w-[60px]">
      <span className={cn('text-xs tabular-nums', pctTextColor(pct))}>{display}</span>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-14" dir="ltr">
        <div
          className={cn('h-full rounded-full', pctBarColor(pct))}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold ring-1 ring-brand-100">
      {name.charAt(0)}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

type DialogState =
  | { open: false }
  | { open: true; mode: 'add' }
  | { open: true; mode: 'edit'; target: SalesTarget };

export function TargetsManagementClient({
  canManage,
  salesUsers,
  targets,
  perfRows,
  hasFilters,
  error,
  symbol = 'ج.م',
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const openAdd = useCallback(() => setDialog({ open: true, mode: 'add' }), []);
  const openEdit = useCallback(
    (target: SalesTarget) => setDialog({ open: true, mode: 'edit', target }),
    [],
  );
  const closeDialog = useCallback(() => setDialog({ open: false }), []);

  const handleSuccess = useCallback(() => {
    setDialog({ open: false });
    toast.show({
      tone: 'success',
      title: dialog.open && dialog.mode === 'edit' ? 'تم تحديث الهدف بنجاح' : 'تم حفظ الهدف بنجاح',
    });
    router.refresh();
  }, [dialog, toast, router]);

  // Build perfMap from the serializable perfRows array
  const perfMap = new Map<string, PerformanceRow>(
    perfRows.map((r) => [`${r.salesId}|${r.period}`, r]),
  );

  return (
    <>
      {/* ── Targets table card ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3">
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Right side: title + count */}
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-sm">الأهداف المسجّلة</CardTitle>
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-surface-muted text-slate-500 text-2xs font-bold px-1.5 tabular-nums">
                {targets.length}
              </span>
            </div>
            {/* Left side: primary action */}
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={openAdd}
              >
                إضافة هدف
              </Button>
            )}
          </div>
        </CardHeader>

        <CardBody className="p-0">
          {error ? (
            <div className="mx-5 my-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : targets.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title={hasFilters ? 'لا توجد أهداف مطابقة' : 'لا توجد أهداف مسجّلة'}
              description={
                hasFilters
                  ? 'لا توجد أهداف تطابق الفلاتر المختارة.'
                  : canManage
                    ? 'ابدأ بإضافة هدف شهري للمندوبين.'
                    : 'لم تُسجَّل أهداف بعد لهذا الشهر.'
              }
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={openAdd}
                  >
                    إضافة هدف
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-5 py-2.5 text-start whitespace-nowrap">المندوب</th>
                    <th className="px-4 py-2.5 text-start whitespace-nowrap">الشهر</th>
                    <th className="px-4 py-2.5 text-end whitespace-nowrap">هدف القيمة</th>
                    <th className="px-4 py-2.5 text-end whitespace-nowrap">المحقق</th>
                    <th className="px-4 py-2.5 text-start whitespace-nowrap">نسبة القيمة</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">الوحدات</th>
                    <th className="px-4 py-2.5 text-start whitespace-nowrap">نسبة الوحدات</th>
                    <th className="px-4 py-2.5 text-start whitespace-nowrap">الأداء</th>
                    {canManage && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {targets.map((t) => {
                    const perf = t.sales?.id
                      ? perfMap.get(`${t.sales.id}|${t.period}`)
                      : undefined;
                    const amtPct = perf?.targetAmountPercent ?? null;
                    const unitPct = perf?.targetUnitsPercent ?? null;
                    const name = t.sales?.fullName ?? '';

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-surface-muted/30 transition-colors"
                      >
                        {/* المندوب */}
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {name && <Initials name={name} />}
                            <span className="font-medium text-slate-800 text-sm">
                              {name || <span className="text-slate-300">—</span>}
                            </span>
                          </div>
                        </td>

                        {/* الشهر */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-600">
                            {periodLabel(t.period)}
                          </span>
                        </td>

                        {/* هدف القيمة */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-end">
                          <span className="tabular-nums font-semibold text-slate-800 text-xs">
                            {fmtAmt(t.amountTarget, symbol)}
                          </span>
                        </td>

                        {/* المحقق */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-end">
                          {perf ? (
                            <span
                              className={cn(
                                'tabular-nums text-xs',
                                perf.achievedAmount > 0
                                  ? 'font-semibold text-emerald-700'
                                  : 'text-slate-400',
                              )}
                            >
                              {fmtAmt(perf.achievedAmount, symbol)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* نسبة القيمة */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <PctCell pct={amtPct} />
                        </td>

                        {/* الوحدات */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-center">
                          <span className="tabular-nums text-xs text-slate-600">
                            {num(t.unitsTarget)}
                          </span>
                          {perf && (
                            <span
                              className={cn(
                                'tabular-nums text-xs ms-1',
                                perf.achievedUnits > 0
                                  ? 'font-semibold text-emerald-700'
                                  : 'text-slate-400',
                              )}
                            >
                              / {num(perf.achievedUnits)}
                            </span>
                          )}
                        </td>

                        {/* نسبة الوحدات */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <PctCell pct={unitPct} />
                        </td>

                        {/* الأداء badge */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <PerfBadge pct={amtPct} />
                        </td>

                        {/* Edit action */}
                        {canManage && (
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {t.salesId && (
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                aria-label="تعديل الهدف"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-700 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-2.5 text-2xs text-slate-400 border-t border-hairline">
                القيم المحققة محسوبة من العقود الموقّعة خلال الشهر لكل مندوب.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Dialog (controlled by state, no URL params) ─────────────────── */}
      {canManage && (
        <TargetFormDialog
          // key forces a clean remount when switching targets so useState
          // initial values are always derived from the current prefillTarget.
          key={dialog.open && dialog.mode === 'edit' ? dialog.target.id : 'add'}
          open={dialog.open}
          mode={dialog.open ? dialog.mode : 'add'}
          prefillTarget={dialog.open && dialog.mode === 'edit' ? dialog.target : undefined}
          salesUsers={salesUsers}
          symbol={symbol}
          onClose={closeDialog}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
