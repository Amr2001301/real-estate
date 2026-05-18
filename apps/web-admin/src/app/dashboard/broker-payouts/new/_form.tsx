'use client';

import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { tx, formatCurrency, formatDate } from '@/lib/format';
import type { AdminEligibleCommission } from '@/lib/types';
import {
  createBrokerPayoutAction,
  type BrokerPayoutActionState,
} from '../actions';

interface Props {
  brokerId: string;
  brokerName: string;
  eligible: AdminEligibleCommission[];
}

export default function CreatePayoutForm({
  brokerId,
  brokerName,
  eligible,
}: Props) {
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    createBrokerPayoutAction,
    {},
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totals = useMemo(() => {
    let gross = 0;
    let tax = 0;
    let withholding = 0;
    let net = 0;
    for (const c of eligible) {
      if (!selected.has(c.id)) continue;
      gross += Number(c.grossAmount) || 0;
      tax += Number(c.taxAmount) || 0;
      withholding += Number(c.withholdingAmount) || 0;
      net += Number(c.netAmount) || 0;
    }
    return { gross, tax, withholding, net };
  }, [eligible, selected]);

  const allSelected = eligible.length > 0 && selected.size === eligible.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === eligible.length
        ? new Set()
        : new Set(eligible.map((c) => c.id)),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      <input type="hidden" name="brokerId" value={brokerId} />

      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <FormSection
        title="بيانات الدفعة"
        description={`الدفعة لشركة ${brokerName}. حدد الفترة المرجعية إن أردت ربطها بالتقارير الشهرية.`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الفترة" name="period" hint="اختياري — صيغة YYYY-MM (مثل 2026-05)">
            <Input
              id="period"
              name="period"
              dir="ltr"
              placeholder="YYYY-MM"
              pattern="\d{4}-(0[1-9]|1[0-2])"
            />
          </Field>
          <Field label="ملاحظات" name="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="العمولات المؤهلة"
        description="عمولات بحالة APPROVED غير مرتبطة بأي دفعة. حدد ما يدخل في هذه الدفعة."
        aside={
          eligible.length > 0 ? (
            <div className="rounded-xl bg-emerald-50/40 border border-emerald-100 p-3 text-2xs space-y-1">
              <p className="text-slate-500">إجماليات المُحدد</p>
              <p>
                إجمالي: <span className="font-semibold">{formatCurrency(totals.gross)}</span>
              </p>
              <p>
                ضريبة: <span className="font-semibold">{formatCurrency(totals.tax)}</span>
              </p>
              <p>
                حجز ضريبي: <span className="font-semibold">{formatCurrency(totals.withholding)}</span>
              </p>
              <p className="text-emerald-700 pt-1 border-t border-emerald-100">
                صافي: <span className="font-bold">{formatCurrency(totals.net)}</span>
              </p>
            </div>
          ) : undefined
        }
      >
        {eligible.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-surface-muted px-4 py-6 text-center text-sm text-slate-600">
            لا توجد عمولات معتمدة وغير مرتبطة بدفعة لهذا الوسيط. اعتمد العمولات من
            صفحة العمولات أولاً.
          </div>
        ) : (
          <div className="rounded-xl border border-hairline overflow-hidden">
            <div className="bg-surface-muted/60 flex items-center gap-2 px-4 py-2 text-2xs font-semibold text-slate-600">
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={allSelected} onChange={toggleAll} />
                <span>تحديد الكل</span>
              </label>
              <span className="ms-auto text-slate-500">
                {selected.size} / {eligible.length}
              </span>
            </div>
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin divide-y divide-hairline">
              {eligible.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-muted/30 cursor-pointer"
                  >
                    <Checkbox
                      name="commissionIds"
                      value={c.id}
                      checked={checked}
                      onChange={() => toggle(c.id)}
                    />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono font-semibold text-slate-900" dir="ltr">
                          {c.commissionNumber}
                        </span>
                        <span className="text-2xs text-slate-500">
                          {formatDate(c.earnedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-700">
                        <span className="font-mono" dir="ltr">{c.contract.contractNumber ?? '—'}</span>
                        {' • '}
                        {c.contract.customer?.fullName ?? '—'}
                      </p>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        <span className="font-mono" dir="ltr">{c.unit.code}</span>
                        {c.project && <> • {tx(c.project.name)}</>}
                      </p>
                      <p className="text-2xs text-slate-600 mt-1 tabular-nums">
                        إجمالي {formatCurrency(c.grossAmount)} • صافي{' '}
                        <span className="font-semibold">{formatCurrency(c.netAmount)}</span>
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/dashboard/broker-payouts">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>إنشاء الدفعة (مسودة)</SubmitButton>
          </>
        }
        helper={`ستُحفظ الدفعة كمسودة ويمكن مراجعتها قبل الاعتماد. عدد المحدد: ${selected.size}`}
      />
    </form>
  );
}
