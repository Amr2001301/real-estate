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
import { num, periodLabel } from './utils';
import { compactParts } from '@/lib/format';
import { Avatar, PaceBar } from '@/components/cockpit/cockpit';
import { attainment, expectedPct, STATUS_BAR, STATUS_CHIP, targetPhase, targetStatus } from '@/lib/target-pace';

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

  const money = (n: number | string) => compactParts(n, symbol, locale).join(' ');

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
            <>
              <ul>
                {targets.map((t) => {
                  const perf = t.sales?.id ? perfMap.get(`${t.sales.id}|${t.period}`) : undefined;
                  const amtPct = perf?.targetAmountPercent ?? null;
                  const unitPct = perf?.targetUnitsPercent ?? null;
                  const status = targetStatus(attainment(amtPct, unitPct), t.period, today);
                  const exp = targetPhase(t.period, today) === 'current' ? expectedPct(t.period, today) : null;
                  const name = t.sales?.fullName ?? '';
                  const pct = (p: number | null) => (p === null ? '—' : p > 999 ? '+999%' : `${p}%`);

                  return (
                    <li
                      key={t.id}
                      data-testid="target-row"
                      className="grid grid-cols-1 items-center gap-4 border-b border-hairline px-6 py-4 transition-colors last:border-b-0 hover:bg-surface-muted/30 lg:grid-cols-[minmax(200px,1.1fr)_1.4fr_1fr_auto_auto]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {name && <Avatar name={name} />}
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-slate-900" dir="auto">{name || '—'}</p>
                          <p className="text-[12px] text-slate-500">{periodLabel(t.period, locale)}</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between gap-2 text-[12px]">
                          <span className="text-slate-500">{m.colAmountTarget}</span>
                          <span className="whitespace-nowrap tabular-nums text-slate-600">
                            <b className="font-bold text-slate-900">{pct(amtPct)}</b>
                            {' · '}{money(perf?.achievedAmount ?? 0)} / {money(t.amountTarget)}
                          </span>
                        </div>
                        <PaceBar className="mt-2" pct={amtPct} expected={exp} tone={STATUS_BAR[status]} />
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between gap-2 text-[12px]">
                          <span className="text-slate-500">{m.colUnits}</span>
                          <span className="whitespace-nowrap tabular-nums text-slate-600">
                            <b className="font-bold text-slate-900">{pct(unitPct)}</b>
                            {' · '}{num(perf?.achievedUnits ?? 0)} / {num(t.unitsTarget)}
                          </span>
                        </div>
                        <PaceBar className="mt-2" pct={unitPct} expected={exp} tone={STATUS_BAR[status]} />
                      </div>

                      <span data-testid="target-status" className={cn('justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold', STATUS_CHIP[status])}>
                        {ts.targetStatus[status]}
                      </span>

                      {canManage && t.salesId ? (
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          aria-label={m.ariaEdit}
                          title={m.btnEdit}
                          className="inline-flex h-9 w-9 items-center justify-center justify-self-start rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : <span />}
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-hairline px-6 py-3.5 text-[12px] text-slate-500">
                {m.tableFootnote}
              </p>
            </>
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
