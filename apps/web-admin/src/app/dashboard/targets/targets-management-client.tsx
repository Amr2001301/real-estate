'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Target } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { TargetFormDialog, type SalesUser, type SalesTarget } from './target-form-dialog';
import { fmtAmt, num, periodLabel } from './utils';
import { attainment, expectedPct, STATUS_BAR, STATUS_CHIP, targetPhase, targetStatus, type TargetStatus } from '@/lib/target-pace';

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
  symbol: string;
  /** The company's today, "YYYY-MM-DD" — for each month's status and pace. */
  today: string;
  locale?: Locale;
}

// ── Inline sub-components ──────────────────────────────────────────────────

function PctCell({ pct, expected, status }: { pct: number | null; expected: number | null; status: TargetStatus }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const display = pct > 999 ? '+999%' : `${pct}%`;
  return (
    <div className="flex min-w-[84px] flex-col gap-1.5">
      <span className="text-[13px] font-semibold tabular-nums text-slate-900">{display}</span>
      <div className="relative h-1.5 w-20 rounded-full bg-surface-muted">
        <span
          className={cn('absolute inset-y-0 start-0 rounded-full', STATUS_BAR[status])}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
        {expected !== null && expected > 0 && expected < 100 && (
          <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-slate-900/70" style={{ insetInlineStart: `calc(${expected}% - 1px)` }} />
        )}
      </div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[14px] font-bold text-brand-700 ring-1 ring-brand-500/40">
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
  symbol,
  today,
  locale = 'ar',
}: Props) {
  const ts = uiT(locale).common;
  const m = uiT(locale).targetsPage;
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
      title: dialog.open && dialog.mode === 'edit' ? m.toastUpdated : m.toastSaved,
    });
    router.refresh();
  }, [dialog, toast, router, m]);

  // Build perfMap from the serializable perfRows array
  const perfMap = new Map<string, PerformanceRow>(
    perfRows.map((r) => [`${r.salesId}|${r.period}`, r]),
  );

  return (
    <>
      {/* ── Targets table card ──────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="font-heading text-[19px] font-bold text-slate-900">{m.tableTitle}</h2>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-muted px-2 text-[12px] font-semibold tabular-nums text-slate-600">
                {targets.length}
              </span>
            </div>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={openAdd}
              >
                {m.btnAddTarget}
              </Button>
            )}
        </header>

        <div className="border-t border-hairline">
          {error ? (
            <div className="mx-6 my-5 flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
              <Target className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : targets.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title={hasFilters ? m.emptyMatchTitle : m.emptyNoneTitle}
              description={
                hasFilters
                  ? m.emptyMatchDesc
                  : canManage
                    ? m.emptyNoneDescAdmin
                    : m.emptyNoneDescView
              }
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={openAdd}
                  >
                    {m.btnAddTarget}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="border-b border-hairline text-[11.5px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5 text-start whitespace-nowrap">{m.colAgent}</th>
                    <th className="px-4 py-3.5 text-start whitespace-nowrap">{m.colMonth}</th>
                    <th className="px-4 py-3.5 text-end whitespace-nowrap">{m.colAmountTarget}</th>
                    <th className="px-4 py-3.5 text-end whitespace-nowrap">{m.colAchieved}</th>
                    <th className="px-4 py-3.5 text-start whitespace-nowrap">{m.colAmountPct}</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">{m.colUnits}</th>
                    <th className="px-4 py-3.5 text-start whitespace-nowrap">{m.colUnitsPct}</th>
                    <th className="px-4 py-3.5 text-start whitespace-nowrap">{m.colPerformance}</th>
                    {canManage && <th className="px-4 py-3.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {targets.map((t) => {
                    const perf = t.sales?.id
                      ? perfMap.get(`${t.sales.id}|${t.period}`)
                      : undefined;
                    const amtPct = perf?.targetAmountPercent ?? null;
                    const unitPct = perf?.targetUnitsPercent ?? null;
                    const status = targetStatus(attainment(amtPct, unitPct), t.period, today);
                    const exp = targetPhase(t.period, today) === 'current' ? expectedPct(t.period, today) : null;
                    const name = t.sales?.fullName ?? '';

                    return (
                      <tr
                        key={t.id}
                        data-testid="target-row"
                        className="transition-colors hover:bg-surface-muted/40"
                      >
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {name && <Initials name={name} />}
                            <span className="font-medium text-slate-800 text-sm">
                              {name || <span className="text-slate-300">—</span>}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-600">
                            {periodLabel(t.period, locale)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-end">
                          <span className="tabular-nums font-semibold text-slate-800 text-xs">
                            {fmtAmt(t.amountTarget, symbol)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-end">
                          {perf ? (
                            <span
                              className={cn(
                                'tabular-nums text-xs',
                                perf.achievedAmount > 0
                                  ? 'font-semibold text-slate-900'
                                  : 'text-slate-400',
                              )}
                            >
                              {fmtAmt(perf.achievedAmount, symbol)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <PctCell pct={amtPct} expected={exp} status={status} />
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <span className="tabular-nums text-xs">
                            <span className={cn(perf && perf.achievedUnits > 0 ? 'font-semibold text-slate-900' : 'text-slate-400')}>
                              {num(perf?.achievedUnits ?? 0)}
                            </span>
                            <span className="text-slate-500"> / {num(t.unitsTarget)}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <PctCell pct={unitPct} expected={exp} status={status} />
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span data-testid="target-status" className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold', STATUS_CHIP[status])}>
                            {ts.targetStatus[status]}
                          </span>
                        </td>

                        {canManage && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {t.salesId && (
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                aria-label={m.ariaEdit}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-700 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>{m.btnEdit}</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-hairline px-6 py-3.5 text-[12px] text-slate-500">
                {m.tableFootnote}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Dialog ─────────────────────────────────────────────────────────── */}
      {canManage && (
        <TargetFormDialog
          key={dialog.open && dialog.mode === 'edit' ? dialog.target.id : 'add'}
          open={dialog.open}
          mode={dialog.open ? dialog.mode : 'add'}
          prefillTarget={dialog.open && dialog.mode === 'edit' ? dialog.target : undefined}
          salesUsers={salesUsers}
          symbol={symbol}
          locale={locale}
          onClose={closeDialog}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
