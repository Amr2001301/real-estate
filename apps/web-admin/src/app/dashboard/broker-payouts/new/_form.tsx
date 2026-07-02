'use client';

import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PremiumFormPanel } from '@/components/premium';
import { tx, formatCurrency, formatDate } from '@/lib/format';
import type { AdminEligibleCommission } from '@/lib/types';
import {
  createBrokerPayoutAction,
  type BrokerPayoutActionState,
} from '../actions';

interface BrokerOption {
  id: string;
  companyName: string;
}

interface Props {
  brokers: BrokerOption[];
  selectedBrokerId: string;
  brokerName: string | null;
  eligible: AdminEligibleCommission[];
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
        {required && <span className="text-danger-500 ms-1">*</span>}
      </p>
      {children}
      {hint && (
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{hint}</p>
      )}
    </div>
  );
}

export default function CreatePayoutForm({
  brokers,
  selectedBrokerId,
  brokerName,
  eligible,
}: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<BrokerPayoutActionState, FormData>(
    createBrokerPayoutAction,
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totals = useMemo(() => {
    let gross = 0, tax = 0, withholding = 0, net = 0;
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
      prev.size === eligible.length ? new Set() : new Set(eligible.map((c) => c.id)),
    );
  }

  function onBrokerChange(brokerId: string) {
    setSelected(new Set());
    const qs = brokerId ? `?brokerId=${brokerId}` : '';
    router.replace(`/dashboard/broker-payouts/new${qs}`);
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="brokerId" value={selectedBrokerId} />

      {state.error && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{state.error}</p>
        </div>
      )}

      {/* ── Panel 01 — Broker ─────────────────────────────────────────────── */}
      <PremiumFormPanel
        id="broker"
        number="01"
        title="الوسيط"
        description="اختر شركة الوساطة. ستُحمّل تلقائيًا العمولات المعتمدة المؤهلة لهذا الوسيط."
      >
        <FormField label="شركة الوساطة" required>
          <Select
            value={selectedBrokerId}
            onChange={(e) => onBrokerChange(e.target.value)}
            required
          >
            <option value="" disabled>اختر شركة الوساطة</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.companyName}
              </option>
            ))}
          </Select>
        </FormField>
      </PremiumFormPanel>

      {/* ── Panel 02 — Eligible Commissions ──────────────────────────────── */}
      <PremiumFormPanel
        id="commissions"
        number="02"
        title="العمولات المؤهلة"
        description="عمولات بحالة APPROVED غير مرتبطة بأي دفعة. حدد ما يدخل في هذه الدفعة."
      >
        {!selectedBrokerId ? (
          <p className="text-sm text-slate-400 py-1">
            اختر وسيطًا أولًا لعرض العمولات المؤهلة.
          </p>
        ) : eligible.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3.5 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              لا توجد عمولات معتمدة وغير مرتبطة بدفعة لهذا الوسيط.
              اعتمد العمولات من صفحة العمولات أولًا.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Commission list */}
            <div className="rounded-[16px] border border-hairline overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3 bg-canvas/40 border-b border-hairline">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                  <span className="text-[11px] font-semibold text-slate-600">تحديد الكل</span>
                </label>
                <span className="ms-auto text-[11px] text-slate-400">
                  {selected.size} من {eligible.length} محدد
                </span>
              </div>

              {/* Commission rows */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-hairline">
                {eligible.map((c) => {
                  const checked = selected.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-100 ${
                        checked ? 'bg-brand-50/30' : 'hover:bg-canvas/40'
                      }`}
                    >
                      <Checkbox
                        name="commissionIds"
                        value={c.id}
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span
                            className="font-mono text-[13px] font-semibold text-slate-900"
                            dir="ltr"
                          >
                            {c.commissionNumber}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatDate(c.earnedAt)}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-600 mt-0.5">
                          <span className="font-mono" dir="ltr">
                            {c.contract.contractNumber ?? '—'}
                          </span>
                          {' · '}
                          {c.contract.customer?.fullName ?? '—'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono" dir="ltr">
                            {c.unit.code}
                          </span>
                          {c.project && <> · {tx(c.project.name)}</>}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          إجمالي {formatCurrency(c.grossAmount)}
                          {' · '}صافي{' '}
                          <span className="font-bold text-success-700">
                            {formatCurrency(c.netAmount)}
                          </span>
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Totals strip — only when items are selected */}
            {selected.size > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 rounded-[16px] border border-hairline overflow-hidden divide-y sm:divide-y-0 divide-x-0 sm:divide-x sm:divide-x-reverse divide-hairline bg-canvas/30">
                <div className="flex flex-col gap-0.5 px-4 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    إجمالي قبل الخصم
                  </p>
                  <p className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(totals.gross)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    الضريبة
                  </p>
                  <p className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(totals.tax)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    حجز ضريبي
                  </p>
                  <p className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(totals.withholding)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3.5 bg-success-50/40">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-success-600">
                    الصافي المستحق
                  </p>
                  <p className="text-[14px] font-bold tabular-nums text-success-700">
                    {formatCurrency(totals.net)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </PremiumFormPanel>

      {/* ── Panel 03 — Details + Submit ──────────────────────────────────── */}
      <PremiumFormPanel
        id="details"
        number="03"
        title="بيانات الدفعة واعتمادها"
        description={
          brokerName
            ? `الدفعة لشركة ${brokerName}. حدد الفترة المرجعية إن أردت ربطها بالتقارير الشهرية.`
            : 'حدد الفترة المرجعية إن أردت ربطها بالتقارير الشهرية.'
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="الفترة"
              hint="اختياري — صيغة YYYY-MM (مثل 2026-05)"
            >
              <Input
                id="period"
                name="period"
                dir="ltr"
                placeholder="YYYY-MM"
                pattern="\d{4}-(0[1-9]|1[0-2])"
              />
            </FormField>
            <FormField label="ملاحظات" hint="اختياري">
              <Textarea id="notes" name="notes" rows={2} />
            </FormField>
          </div>

          <div className="flex items-center justify-between gap-4 pt-5 border-t border-hairline">
            <p className="text-[11px] text-slate-400 leading-snug max-w-xs">
              ستُحفظ الدفعة كمسودة ويمكن مراجعتها قبل الاعتماد.
              {selected.size > 0 && (
                <>
                  {' '}عدد المحدد:{' '}
                  <span className="font-semibold text-slate-600">{selected.size}</span>
                </>
              )}
            </p>
            <div className="flex items-center gap-2.5 shrink-0">
              <Link href="/dashboard/broker-payouts">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="h-4 w-4" />}
                >
                  إلغاء
                </Button>
              </Link>
              <SubmitButton>إنشاء الدفعة (مسودة)</SubmitButton>
            </div>
          </div>
        </div>
      </PremiumFormPanel>
    </form>
  );
}
