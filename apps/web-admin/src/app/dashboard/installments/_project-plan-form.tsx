'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { formatCurrency } from '@/lib/format';
import { computeDurationOption } from '@/lib/installment-calc';
import { currencySymbol } from '@/lib/currency-format';
import type { InstallmentPlanTemplate, PlanPreview, PlanScopeInfo, Translatable } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { projectPlansT } from '@/messages/project-plans';
import {
  createProjectPlanAction,
  getScopeInfoAction,
  previewProjectPlanAction,
  updateProjectPlanAction,
  type PlanFormState,
} from './actions';

interface ProjectOption {
  id: string;
  name: Translatable;
}

interface Props {
  projects: ProjectOption[];
  initialData?: InstallmentPlanTemplate;
  mode: 'create' | 'edit';
  currency: string;
  locale?: Locale;
}

interface DurationRow {
  key: string;
  months: string;
  pct: string;
}

function RadioCard({
  name, value, checked, onChange, disabled, children,
}: { name?: string; value: string; checked: boolean; onChange: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      } ${checked ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-hairline bg-surface text-muted hover:border-brand-300'}`}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="accent-brand-500" />
      <span>{children}</span>
    </label>
  );
}

const key = () => Math.random().toString(36).slice(2, 10);
const text = (t: Translatable | string, locale: Locale) =>
  typeof t === 'string' ? t : ((locale === 'en' ? t.en : t.ar) || t.ar || t.en || '');
const dateOnly = (v?: string | null) => (v ? v.slice(0, 10) : '');

export default function ProjectPlanForm({ projects, initialData: d, mode, currency, locale = 'ar' }: Props) {
  const m = projectPlansT(locale);
  const action = mode === 'edit' && d ? updateProjectPlanAction.bind(null, d.id) : createProjectPlanAction;
  const [state, formAction] = useActionState<PlanFormState, FormData>(action, {});

  const termsLocked = mode === 'edit' && (d?.reservationsInUse ?? 0) > 0;

  const [projectId, setProjectId] = useState(d?.projectId ?? '');
  const [scopeKind, setScopeKind] = useState<'PROJECT' | 'TYPE'>((d?.unitTypes?.length ?? 0) > 0 ? 'TYPE' : 'PROJECT');
  const [unitTypes, setUnitTypes] = useState<string[]>(d?.unitTypes ?? []);
  const [info, setInfo] = useState<PlanScopeInfo | null>(null);

  const [isCash, setIsCash] = useState(d?.isCash === true);
  const [discount, setDiscount] = useState(String(Number(d?.discountValue ?? 0)));
  const [bookingType, setBookingType] = useState<'FIXED' | 'PERCENTAGE'>(
    d?.reservationAmountType === 'FIXED' ? 'FIXED' : mode === 'edit' ? 'PERCENTAGE' : 'PERCENTAGE',
  );
  const [booking, setBooking] = useState(String(Number(d?.reservationAmountValue ?? 2)));
  const [down, setDown] = useState(String(Number(d?.downPaymentValue ?? 10)));
  const [startRule, setStartRule] = useState(d?.startDateRule ?? 'AFTER_RESERVATION');
  const [manualStart, setManualStart] = useState(dateOnly(d?.manualStartDate));
  const [rows, setRows] = useState<DurationRow[]>(
    d?.durationOptions?.length
      ? d.durationOptions.map((o) => ({ key: key(), months: String(o.durationMonths), pct: String(Number(o.increasePercentage)) }))
      : [
          { key: key(), months: '60', pct: '0' },
          { key: key(), months: '84', pct: '0' },
        ],
  );

  // Unit types (with counts) of the chosen project.
  useEffect(() => {
    let live = true;
    setInfo(null);
    if (projectId) {
      getScopeInfoAction(projectId).then((r) => {
        if (live) setInfo(r);
      });
    }
    return () => {
      live = false;
    };
  }, [projectId]);

  const activeTypes = useMemo(() => (scopeKind === 'TYPE' ? unitTypes : []), [scopeKind, unitTypes]);
  const unitsInScope = useMemo(() => {
    if (!info) return d?.unitsInScope ?? 0;
    if (activeTypes.length === 0) return info.totalUnits;
    return info.unitTypes.filter((t) => activeTypes.includes(t.code)).reduce((n, t) => n + t.units, 0);
  }, [info, activeTypes, d?.unitsInScope]);

  const durationOptions = useMemo(
    () =>
      rows
        .map((r) => ({ durationMonths: Number(r.months), increasePercentage: Number(r.pct || 0) }))
        .filter((o) => o.durationMonths > 0 && o.increasePercentage >= 0),
    [rows],
  );

  // Live preview on real units, from the same code that prices a reservation.
  const [preview, setPreview] = useState<PlanPreview | { error: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (!projectId) {
      setPreview(null);
      return;
    }
    const n = ++seq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      const res = await previewProjectPlanAction({
        projectId,
        unitTypes: activeTypes,
        isCash,
        discountType: 'PERCENTAGE',
        discountValue: Number(discount || 0),
        reservationAmountType: bookingType,
        reservationAmountValue: Number(booking || 0),
        ...(isCash ? {} : { downPaymentType: 'PERCENTAGE', downPaymentValue: Number(down || 0), durationOptions }),
      });
      if (n === seq.current) {
        setPreview(res);
        setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, JSON.stringify(activeTypes), isCash, discount, bookingType, booking, down, JSON.stringify(durationOptions)]);

  const symbol = currencySymbol(currency, locale);
  const money = (v: number) => formatCurrency(v, currency, locale);
  const shown = preview && !('error' in preview) ? preview : null;
  const previewError = preview && 'error' in preview ? preview.error : (shown?.problem ?? null);
  const monthsShown = durationOptions[0]?.durationMonths;
  const sample = shown?.rows.find((r) => !r.ownPlan) ?? null;

  const navSections = [
    { id: 'section-plan', num: '01', label: m.s1Title, sub: m.s1Sub },
    { id: 'section-pricing', num: '02', label: m.s2Title, sub: m.s2Sub },
    ...(isCash ? [] : [{ id: 'section-durations', num: '03', label: m.s3Title, sub: m.s3Sub }]),
    { id: 'section-preview', num: isCash ? '03' : '04', label: m.s4Title, sub: m.s4Sub },
  ];

  const lock = termsLocked ? { disabled: true } : {};
  const typeNoteN = unitsInScope;

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {mode === 'edit' && (d?.reservationsInUse ?? 0) > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{m.warnInUse(d?.reservationsInUse ?? 0)}</p>
        </div>
      )}
      {mode === 'edit' && (d?.reservationsTotal ?? 0) > 0 && !termsLocked && (
        <div className="flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{m.warnFrozen(d?.reservationsTotal ?? 0)}</p>
        </div>
      )}

      <input type="hidden" name="termsLocked" value={termsLocked ? 'true' : 'false'} />
      <input type="hidden" name="isCash" value={isCash ? 'true' : 'false'} />
      <input type="hidden" name="unitTypes" value={JSON.stringify(activeTypes)} />
      <input type="hidden" name="durationOptions" value={JSON.stringify(durationOptions)} />

      <PremiumFormLayout navSections={navSections} sidebarBadge={mode === 'edit' ? m.editTitle : m.newTitle} sidebarInfo={m.newDescription}>
        <PremiumFormPanel id="section-plan" number="01" title={m.s1Title} description={m.s1Sub}>
          <div className="flex flex-col gap-5">
            <Field label={m.name} name="name" required>
              <Input id="name" name="name" required defaultValue={d?.name} placeholder={m.namePlaceholder} />
            </Field>
            <Field label={m.description} name="description">
              <Textarea id="description" name="description" rows={2} defaultValue={d?.description ?? ''} />
            </Field>
            <Field label={m.project} name="projectId" required>
              {/* The project of a saved plan is fixed. */}
              {mode === 'edit' ? <input type="hidden" name="projectId" value={projectId} /> : null}
              <Select
                id="projectId"
                name={mode === 'edit' ? undefined : 'projectId'}
                required
                disabled={mode === 'edit'}
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setUnitTypes([]);
                }}
              >
                <option value="">{m.chooseProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {text(p.name, locale)}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <span className="text-sm font-medium text-slate-700">{m.scope}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                <RadioCard value="PROJECT" checked={scopeKind === 'PROJECT'} onChange={() => setScopeKind('PROJECT')}>{m.scopeProject}</RadioCard>
                <RadioCard value="TYPE" checked={scopeKind === 'TYPE'} onChange={() => setScopeKind('TYPE')}>{m.scopeTypes}</RadioCard>
              </div>
            </div>

            {scopeKind === 'TYPE' && (
              <Field label={m.pickTypes} name="unitTypePicker">
                {info && info.unitTypes.length === 0 ? (
                  <p className="text-sm text-slate-500">{m.noTypes}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(info?.unitTypes ?? unitTypes.map((c) => ({ code: c, name: c, units: 0 }))).map((t) => {
                      const on = unitTypes.includes(t.code);
                      return (
                        <button
                          type="button"
                          key={t.code}
                          onClick={() => setUnitTypes((cur) => (on ? cur.filter((c) => c !== t.code) : [...cur, t.code]))}
                          className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                            on ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-hairline bg-surface text-muted hover:border-brand-300'
                          }`}
                        >
                          {text(t.name, locale)}
                          {t.units > 0 && <span className="ms-1.5 text-xs opacity-70">· {m.typeUnits(t.units)}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Field>
            )}

            {projectId && (
              <div className="rounded-xl bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2.5 text-sm">
                {scopeKind === 'TYPE' ? m.scopeNoteTypes(typeNoteN) : m.scopeNote(typeNoteN)}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={m.status} name="status">
                <Select id="status" name="status" defaultValue={d?.status ?? 'DRAFT'}>
                  <option value="DRAFT">{m.statusDraft}</option>
                  <option value="ACTIVE">{m.statusActive}</option>
                  <option value="INACTIVE">{m.statusInactive}</option>
                </Select>
              </Field>
              <Field label={m.visibility} name="visibility">
                <Select id="visibility" name="visibility" defaultValue={d?.visibility === 'PUBLIC' ? 'PUBLIC' : 'SALES_ONLY'}>
                  <option value="SALES_ONLY">{m.visibilitySales}</option>
                  <option value="PUBLIC">{m.visibilityPublic}</option>
                </Select>
              </Field>
              <Field label={`${m.validity} — ${m.validFrom}`} name="validFrom">
                <Input id="validFrom" name="validFrom" type="date" defaultValue={dateOnly(d?.validFrom)} />
              </Field>
              <Field label={`${m.validity} — ${m.validTo}`} name="validTo" hint={m.validityHint}>
                <Input id="validTo" name="validTo" type="date" defaultValue={dateOnly(d?.validTo)} />
              </Field>
            </div>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="section-pricing" number="02" title={m.s2Title} description={m.s2Sub}>
          <div className="flex flex-col gap-5">
            <div>
              <span className="text-sm font-medium text-slate-700">{m.planType}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                <RadioCard value="INSTALLMENTS" checked={!isCash} disabled={mode === 'edit'} onChange={() => setIsCash(false)}>{m.typeInstallment}</RadioCard>
                <RadioCard value="CASH" checked={isCash} disabled={mode === 'edit'} onChange={() => setIsCash(true)}>{m.typeCash}</RadioCard>
              </div>
            </div>

            <Field label={m.discount} name="discountValue" hint={m.discountHint}>
              <Input id="discountValue" name="discountValue" type="number" min={0} max={100} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="max-w-40" {...lock} />
            </Field>

            <div>
              <span className="text-sm font-medium text-slate-700">{m.reservation}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                <RadioCard name={termsLocked ? undefined : 'reservationAmountType'} value="PERCENTAGE" checked={bookingType === 'PERCENTAGE'} disabled={termsLocked} onChange={() => setBookingType('PERCENTAGE')}>{m.reservationPct}</RadioCard>
                <RadioCard name={termsLocked ? undefined : 'reservationAmountType'} value="FIXED" checked={bookingType === 'FIXED'} disabled={termsLocked} onChange={() => setBookingType('FIXED')}>{m.reservationFixed}</RadioCard>
              </div>
            </div>
            <Field label={bookingType === 'FIXED' ? m.reservationFixedLabel(symbol) : m.reservationPctLabel} name="reservationAmountValue" required>
              <Input id="reservationAmountValue" name="reservationAmountValue" type="number" min={0} step="0.01" value={booking} onChange={(e) => setBooking(e.target.value)} className="max-w-40" {...lock} />
            </Field>
            {!isCash && (
              <Field label={m.downPayment} name="downPaymentValue" required>
                <Input id="downPaymentValue" name="downPaymentValue" type="number" min={0} max={100} step="0.01" value={down} onChange={(e) => setDown(e.target.value)} className="max-w-40" {...lock} />
              </Field>
            )}

            {sample && (
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm">
                <p className="text-brand-700 font-medium">{m.sampleTitle(sample.code, money(sample.price))}</p>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    [m.colNet, sample.netPrice],
                    [m.colBooking, sample.reservationAmount],
                    ...(isCash ? [] : [[m.colDown, sample.downPaymentAmount]]),
                  ].map(([l, v]) => (
                    <div key={String(l)}>
                      <p className="text-brand-700/80 text-xs">{l}</p>
                      <p className="text-brand-900 text-base font-bold tabular-nums">{money(Number(v))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* A disabled control is not submitted: keep the values for the form post. */}
            {termsLocked && (
              <>
                <input type="hidden" name="discountValue" value={discount} />
                <input type="hidden" name="downPaymentValue" value={down} />
                <input type="hidden" name="reservationAmountType" value={bookingType} />
                <input type="hidden" name="reservationAmountValue" value={booking} />
              </>
            )}
            <div className="rounded-xl bg-canvas/40 border border-hairline p-3 text-xs text-slate-600">{m.pctOnlyNote}</div>
          </div>
        </PremiumFormPanel>

        {!isCash && (
          <PremiumFormPanel id="section-durations" number="03" title={m.s3Title} description={m.s3Sub}>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-hairline overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas/40 border-b border-hairline">
                    <tr>
                      <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">{m.durationMonths}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">{m.increase}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">{m.colFinanced}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">{m.colMonthlyShort}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">{m.colTotal}</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {rows.map((r) => {
                      const months = Number(r.months);
                      const calc = sample && months > 0
                        ? computeDurationOption({
                            netPrice: sample.netPrice,
                            reservationAmount: sample.reservationAmount,
                            downPaymentAmount: sample.downPaymentAmount,
                            durationMonths: months,
                            increasePercentage: Number(r.pct || 0),
                          })
                        : null;
                      return (
                        <tr key={r.key} className="hover:bg-canvas/40 transition-colors">
                          <td className="px-3 py-2">
                            <Input type="text" inputMode="numeric" placeholder="12" value={r.months} className="max-w-24" disabled={termsLocked}
                              onChange={(e) => { const v = e.target.value; if (v === '' || /^[0-9]+$/.test(v)) setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, months: v } : x))); }} />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="text" inputMode="decimal" placeholder="0" value={r.pct} className="max-w-28" disabled={termsLocked}
                              onChange={(e) => { const v = e.target.value; if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, pct: v } : x))); }} />
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums text-slate-700">{calc ? money(calc.financedAmount) : '—'}</td>
                          <td className="px-3 py-2 text-end tabular-nums font-medium">{calc ? money(calc.monthlyInstallment) : '—'}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-slate-700">{calc ? money(calc.totalPayable) : '—'}</td>
                          <td className="px-3 py-2 text-end">
                            {!termsLocked && rows.length > 1 && (
                              <button type="button" aria-label={m.removeDuration} onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))} className="p-1.5 rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600 transition">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sample && <p className="text-xs text-slate-500">{m.durationSampleNote(sample.code)}</p>}
              {!termsLocked && (
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRows((cur) => [...cur, { key: key(), months: '', pct: '0' }])} leftIcon={<Plus className="h-4 w-4" />}>
                    {m.addDuration}
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-700">{m.startRule}</p>
                <div className="flex flex-wrap gap-3">
                {(['AFTER_RESERVATION', 'AFTER_CONTRACT', 'MANUAL'] as const).map((r) => (
                  <RadioCard key={r} name={termsLocked ? undefined : 'startDateRule'} value={r} checked={startRule === r} disabled={termsLocked} onChange={() => setStartRule(r)}>
                    {r === 'AFTER_RESERVATION' ? m.startAfterReservation : r === 'AFTER_CONTRACT' ? m.startAfterContract : m.startManual}
                  </RadioCard>
                ))}
                </div>
                {termsLocked && <input type="hidden" name="startDateRule" value={startRule} />}
                {startRule === 'MANUAL' && (
                  <Field label={m.startManualDate} name="manualStartDate" required>
                    <Input id="manualStartDate" name="manualStartDate" type="date" required value={manualStart} onChange={(e) => setManualStart(e.target.value)} disabled={termsLocked} />
                  </Field>
                )}
              </div>
            </div>
          </PremiumFormPanel>
        )}

        <PremiumFormPanel id="section-preview" number={isCash ? '03' : '04'} title={m.s4Title} description={m.s4Sub}>
          {!projectId ? (
            <p className="text-sm text-slate-500">{m.previewHint}</p>
          ) : previewError ? (
            <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{previewError}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline overflow-x-auto" aria-busy={previewing}>
              <table className="w-full text-sm">
                <thead className="bg-canvas/40 border-b border-hairline">
                  <tr>
                    {[m.colUnit, m.colPrice, m.colNet, m.colBooking, ...(isCash ? [] : [m.colDown])].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">
                        {h}
                      </th>
                    ))}
                    {!isCash && monthsShown ? <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">{m.colMonthly(monthsShown)}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(shown?.rows ?? []).map((r) => (
                    <tr key={r.unitId} className="border-t border-hairline">
                      <td className="px-3 py-2 font-medium">
                        {r.code} <span className="text-xs text-slate-500">· {r.type}</span>
                        {r.ownPlan && <span className="ms-2 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-xs">{m.ownPlanBadge}</span>}
                      </td>
                      <td className="px-3 py-2">{money(r.price)}</td>
                      {r.ownPlan ? (
                        <td colSpan={isCash ? 3 : 4} className="px-3 py-2 text-slate-500">
                          {m.ownPlanRow}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2">{money(r.netPrice)}</td>
                          <td className="px-3 py-2">{money(r.reservationAmount)}</td>
                          {!isCash && <td className="px-3 py-2">{money(r.downPaymentAmount)}</td>}
                          {!isCash && monthsShown ? <td className="px-3 py-2">{r.options[0] ? money(r.options[0].monthly) : '—'}</td> : null}
                        </>
                      )}
                    </tr>
                  ))}
                  {!shown && <tr><td className="px-3 py-3 text-slate-500" colSpan={6}>{m.previewLoading}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={<SubmitButton pendingLabel="…">{mode === 'create' ? m.newTitle : m.editTitle}</SubmitButton>}
        secondary={
          <Link href="/dashboard/installments">
            <Button variant="ghost" size="md" type="button">
              {locale === 'en' ? 'Cancel' : 'إلغاء'}
            </Button>
          </Link>
        }
      />
    </form>
  );
}
