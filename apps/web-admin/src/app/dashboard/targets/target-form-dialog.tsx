'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { upsertTarget } from './actions';
import { getMonthOptions, YEAR_OPTIONS, periodLabel } from './utils';

export interface SalesUser {
  id: string;
  fullName: string;
  role?: string;
}

export interface SalesTarget {
  id: string;
  salesId: string; // FK — always present, used as the primary key for select
  period: string;
  amountTarget: string | number;
  unitsTarget: number;
  sales?: { id: string; fullName: string } | null;
}

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  prefillTarget?: SalesTarget;
  salesUsers: SalesUser[];
  symbol?: string;
  locale?: Locale;
  onClose: () => void;
  onSuccess: () => void;
}

export function TargetFormDialog({
  open,
  mode,
  prefillTarget,
  salesUsers,
  symbol = 'ج.م',
  locale = 'ar',
  onClose,
  onSuccess,
}: Props) {
  const m = uiT(locale).targetsPage;
  const monthOptions = getMonthOptions(locale);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [salesId, setSalesId] = useState(
    prefillTarget?.salesId ?? prefillTarget?.sales?.id ?? '',
  );
  const [year, setYear] = useState(
    prefillTarget?.period?.split('-')[0] ?? String(new Date().getFullYear()),
  );
  const [month, setMonth] = useState(prefillTarget?.period?.split('-')[1] ?? '');
  const [amountTarget, setAmountTarget] = useState(
    prefillTarget ? String(prefillTarget.amountTarget) : '',
  );
  const [unitsTarget, setUnitsTarget] = useState(
    prefillTarget ? String(prefillTarget.unitsTarget) : '',
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!salesId) { setError(m.validationAgent); return; }
    if (!month)   { setError(m.validationMonth); return; }
    if (!year)    { setError(m.validationYear); return; }

    const amtNum = Number(amountTarget);
    const unitsNum = Number(unitsTarget);
    if (!amountTarget || isNaN(amtNum) || amtNum < 0) {
      setError(m.validationAmount);
      return;
    }
    if (!unitsTarget || isNaN(unitsNum) || unitsNum < 0) {
      setError(m.validationUnits);
      return;
    }

    startTransition(async () => {
      const result = await upsertTarget({
        salesId,
        period: `${year}-${month}`,
        amountTarget: amtNum,
        unitsTarget: unitsNum,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  const salesName =
    prefillTarget?.sales?.fullName ??
    salesUsers.find((u) => u.id === salesId)?.fullName ??
    '';
  const title =
    mode === 'edit' && prefillTarget
      ? `${m.dialogEditPrefix}: ${salesName} · ${periodLabel(prefillTarget.period, locale)}`
      : m.dialogAddTitle;

  return (
    <Dialog
      open={open}
      onClose={isPending ? () => {} : onClose}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            {m.dialogBtnCancel}
          </Button>
          <Button
            form="target-form"
            type="submit"
            variant="primary"
            size="sm"
            disabled={isPending}
            leftIcon={
              mode === 'edit'
                ? <Pencil className="h-3.5 w-3.5" />
                : <Plus className="h-3.5 w-3.5" />
            }
          >
            {isPending ? m.dialogBtnSaving : mode === 'edit' ? m.dialogBtnSaveEdit : m.dialogBtnSaveNew}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
          {mode === 'edit'
            ? <Pencil className="h-3.5 w-3.5 text-brand-700" />
            : <Plus className="h-3.5 w-3.5 text-brand-700" />}
        </div>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight leading-tight">
          {title}
        </h2>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form id="target-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Agent */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            {m.dialogFieldAgent} {mode === 'add' && <span className="text-red-400">*</span>}
          </label>
          {mode === 'edit' ? (
            <div className="flex h-8 items-center rounded-lg border border-hairline bg-surface-muted px-2.5 text-xs font-medium text-slate-700">
              {salesName || salesId}
            </div>
          ) : (
            <Select
              value={salesId}
              onChange={(e) => setSalesId(e.target.value)}
              inputSize="sm"
              disabled={isPending}
            >
              <option value="">{m.dialogChooseAgent}</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.role === 'SALES_MANAGER'
                    ? `${u.fullName} — ${m.roleManager}`
                    : `${u.fullName} — ${m.roleSales}`}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Month + Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">
              {m.dialogFieldMonth} <span className="text-red-400">*</span>
            </label>
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              inputSize="sm"
              disabled={isPending}
            >
              <option value="">{m.dialogChooseMonth}</option>
              {monthOptions.map((mo) => (
                <option key={mo.value} value={mo.value}>{mo.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">
              {m.dialogFieldYear} <span className="text-red-400">*</span>
            </label>
            <Select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              inputSize="sm"
              disabled={isPending}
            >
              <option value="">{m.dialogChooseYear}</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Amount target */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            {m.dialogFieldAmountTarget} ({symbol}) <span className="text-red-400">*</span>
          </label>
          <Input
            type="number"
            step="any"
            min={0}
            inputSize="sm"
            placeholder={m.dialogAmountPlaceholder}
            value={amountTarget}
            onChange={(e) => setAmountTarget(e.target.value)}
            disabled={isPending}
          />
        </div>

        {/* Units target */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            {m.dialogFieldUnitsTarget} <span className="text-red-400">*</span>
          </label>
          <Input
            type="number"
            min={0}
            inputSize="sm"
            placeholder={m.dialogUnitsPlaceholder}
            value={unitsTarget}
            onChange={(e) => setUnitsTarget(e.target.value)}
            disabled={isPending}
          />
        </div>

        <p className="text-2xs text-slate-400">
          {mode === 'edit' ? m.dialogNoteEdit : m.dialogNoteAdd}
        </p>
      </form>
    </Dialog>
  );
}
