'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  AlertCircle,
  CalendarClock,
  FileSignature,
  KeyRound,
  Phone,
  Plus,
  Undo2,
  X,
} from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { compactParts, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  listingsT,
  type ListingKind,
  type ListingTerms,
  type RentRow,
  type Tenancy,
} from '@/components/listings/messages';
import {
  cancelMandateAction,
  createMandateAction,
  createTenancyAction,
  endTenancyAction,
  recordRentAction,
  removeRentPaymentAction,
  type ListingFormState,
} from '../actions';

const label = 'block text-[12.5px] font-semibold text-slate-600';

function Panel({
  icon,
  title,
  sub,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-hairline bg-surface p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B66A]/45 bg-[#0E1626] text-[#E6C77E] [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {icon}
          </span>
          <div>
            <h2 className="font-heading text-[17px] font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>
          </div>
        </div>
        {action}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'rose' | 'slate' | 'gold';
  children: React.ReactNode;
}) {
  const cls = {
    green: 'bg-success-50 text-success-700 border-success-100',
    amber: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
    rose: 'bg-danger-50 text-danger-700 border-danger-100',
    slate: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    gold: 'bg-[#D8B66A]/12 text-brand-700 border-[#D8B66A]/35',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold',
        cls,
      )}
    >
      {children}
    </span>
  );
}

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-danger-500/10 px-3 py-2 text-[12.5px] font-medium text-danger-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
    </p>
  );
}

/** BRK-2 — the owner's mandate and, for a rent, the tenancy with its months. */
export function ListingTermsPanels({
  listingId,
  kind,
  price,
  terms,
  locale,
  symbol,
  today,
  canUndo,
}: {
  listingId: string;
  kind: ListingKind;
  price: number;
  terms: ListingTerms;
  locale: Locale;
  symbol: string;
  today: string;
  canUndo: boolean;
}) {
  const money = (n: number) => compactParts(n, symbol, locale).join(' ');
  return (
    <>
      {kind !== 'PRIMARY' && (
        <MandatePanel
          listingId={listingId}
          terms={terms}
          locale={locale}
          money={money}
          today={today}
        />
      )}
      {kind === 'RENT' && (
        <TenancyPanel
          listingId={listingId}
          price={price}
          terms={terms}
          locale={locale}
          money={money}
          today={today}
          canUndo={canUndo}
        />
      )}
    </>
  );
}

function MandatePanel({
  listingId,
  terms,
  locale,
  money,
  today,
}: {
  listingId: string;
  terms: ListingTerms;
  locale: Locale;
  money: (n: number) => string;
  today: string;
}) {
  const t = listingsT(locale).terms;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'PCT' | 'AMOUNT'>('PCT');
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState<ListingFormState, FormData>(async (prev, fd) => {
    const res = await createMandateAction(listingId, prev, fd);
    if (!res.error) setOpen(false);
    return res;
  }, {});
  const current = terms.mandates.find((m) => m.state === 'ACTIVE' || m.state === 'UPCOMING');
  const plusYear = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <Panel
      icon={<FileSignature />}
      title={t.mandate}
      sub={t.mandateSub}
      action={
        !open && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setOpen(true)}
            data-testid="mandate-new"
          >
            {t.newMandate}
          </Button>
        )
      }
    >
      {open && (
        <form
          action={action}
          className="mb-5 space-y-4 rounded-2xl border border-[#D8B66A]/40 bg-[#D8B66A]/[0.05] p-4"
          data-testid="mandate-form"
        >
          <ErrorLine error={state.error} />
          <input type="hidden" name="commissionMode" value={mode} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={label}>
              {t.kindLabel}
              <Select name="kind" defaultValue="EXCLUSIVE" className="mt-1.5">
                {Object.entries(t.mandateKind).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </label>
            <div>
              <span className={label}>{t.commission}</span>
              <div className="mt-1.5 flex gap-2">
                <div className="flex shrink-0 rounded-full border border-hairline p-0.5 text-[12px] font-bold">
                  {(['PCT', 'AMOUNT'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMode(v)}
                      className={cn(
                        'rounded-full px-3 py-1.5',
                        mode === v ? 'bg-[#0E1626] text-[#F4ECD8]' : 'text-slate-500',
                      )}
                    >
                      {v === 'PCT' ? '%' : t.commissionAmount}
                    </button>
                  ))}
                </div>
                <Input
                  name="commissionValue"
                  type="number"
                  required
                  min={mode === 'PCT' ? 0.01 : 1}
                  max={mode === 'PCT' ? 100 : undefined}
                  step="0.01"
                  dir="ltr"
                  placeholder={mode === 'PCT' ? '2.5' : ''}
                />
              </div>
            </div>
            <label className={label}>
              {t.from}
              <Input
                name="startDate"
                type="date"
                required
                defaultValue={today}
                className="mt-1.5"
              />
            </label>
            <label className={label}>
              {t.to}
              <Input
                name="endDate"
                type="date"
                required
                defaultValue={plusYear}
                className="mt-1.5"
              />
            </label>
            <label className={cn(label, 'sm:col-span-2')}>
              {t.notes}
              <Input name="notes" className="mt-1.5" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {listingsT(locale).form.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              data-testid="mandate-save"
            >
              {t.saveMandate}
            </Button>
          </div>
        </form>
      )}

      {terms.mandates.length === 0 ? (
        !open && <p className="text-[13.5px] text-slate-500">{t.noMandate}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {terms.mandates.map((m) => {
            const live = m.state === 'ACTIVE' || m.state === 'UPCOMING';
            return (
              <li
                key={m.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0',
                  !live && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-slate-900">
                    {t.mandateKind[m.kind]}
                    <Pill
                      tone={
                        m.state === 'ACTIVE'
                          ? m.expiringSoon
                            ? 'amber'
                            : 'green'
                          : m.state === 'UPCOMING'
                            ? 'gold'
                            : 'slate'
                      }
                    >
                      {t.mandateState[m.state]}
                    </Pill>
                    {m.state === 'ACTIVE' && (
                      <span className="text-[12px] font-semibold text-slate-500">
                        {t.daysLeft(m.daysLeft)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    <span className="tabular-nums">
                      {formatDate(m.startDate, locale)} — {formatDate(m.endDate, locale)}
                    </span>
                    {' · '}
                    {t.commission}{' '}
                    <span className="font-bold text-slate-800 tabular-nums">
                      {m.commissionPct
                        ? `${Number(m.commissionPct)}%`
                        : money(Number(m.commissionAmount))}
                    </span>
                  </p>
                  {m.notes && <p className="mt-1 text-[12.5px] text-slate-600">{m.notes}</p>}
                </div>
                {live && m === current && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    leftIcon={<X className="h-4 w-4" />}
                    className="text-danger-700"
                    onClick={() =>
                      window.confirm(t.cancelMandateConfirm) &&
                      start(() => cancelMandateAction(listingId, m.id))
                    }
                  >
                    {t.cancelMandate}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TenancyPanel({
  listingId,
  price,
  terms,
  locale,
  money,
  today,
  canUndo,
}: {
  listingId: string;
  price: number;
  terms: ListingTerms;
  locale: Locale;
  money: (n: number) => string;
  today: string;
  canUndo: boolean;
}) {
  const t = listingsT(locale).terms;
  const active = terms.tenancies.find((x) => x.status === 'ACTIVE');
  const past = terms.tenancies.filter((x) => x.status === 'ENDED');
  const [pending, start] = useTransition();
  return (
    <Panel
      icon={<KeyRound />}
      title={t.tenancy}
      sub={t.tenancySub}
      action={
        active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-danger-700"
            onClick={() =>
              window.confirm(t.endTenancyConfirm) &&
              start(() => endTenancyAction(listingId, active.id))
            }
            data-testid="tenancy-end"
          >
            {t.endTenancy}
          </Button>
        )
      }
    >
      {active ? (
        <ActiveTenancy
          listingId={listingId}
          tenancy={active}
          locale={locale}
          money={money}
          today={today}
          canUndo={canUndo}
        />
      ) : (
        <NewTenancy listingId={listingId} price={price} locale={locale} today={today} />
      )}
      {past.length > 0 && (
        <details className="mt-5 border-t border-hairline pt-4">
          <summary className="cursor-pointer text-[13px] font-bold text-slate-600">
            {t.past} ({past.length})
          </summary>
          <ul className="mt-3 space-y-2 text-[12.5px] text-slate-600">
            {past.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold text-slate-800">{p.tenantName}</span>
                <span className="tabular-nums">
                  {formatDate(p.startDate, locale)} — {formatDate(p.endDate, locale)} ·{' '}
                  {money(Number(p.monthlyRent))} · {t.ended}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function NewTenancy({
  listingId,
  price,
  locale,
  today,
}: {
  listingId: string;
  price: number;
  locale: Locale;
  today: string;
}) {
  const t = listingsT(locale).terms;
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState<ListingFormState, FormData>(
    (prev, fd) => createTenancyAction(listingId, prev, fd),
    {},
  );
  const plusYear = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-hairline p-4">
        <p className="text-[13.5px] text-slate-500">{t.noTenancy}</p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setOpen(true)}
          data-testid="tenancy-new"
        >
          {t.newTenancy}
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" data-testid="tenancy-form">
      <ErrorLine error={state.error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          {t.tenantName}
          <Input
            name="tenantName"
            required
            minLength={2}
            className="mt-1.5"
            data-testid="tenant-name"
          />
        </label>
        <label className={label}>
          {t.tenantPhone}
          <Input
            name="tenantPhone"
            type="tel"
            required
            dir="ltr"
            className="mt-1.5"
            data-testid="tenant-phone"
          />
        </label>
        <label className={label}>
          {t.start}
          <Input name="startDate" type="date" required defaultValue={today} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.end}
          <Input name="endDate" type="date" required defaultValue={plusYear} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.rent}
          <Input
            name="monthlyRent"
            type="number"
            required
            min={1}
            step="0.01"
            defaultValue={price}
            dir="ltr"
            className="mt-1.5"
          />
        </label>
        <label className={label}>
          {t.paymentDay}
          <Input
            name="paymentDay"
            type="number"
            required
            min={1}
            max={28}
            defaultValue={Number(today.slice(8, 10)) > 28 ? 1 : Number(today.slice(8, 10))}
            dir="ltr"
            className="mt-1.5"
          />
          <span className="mt-1 block text-[11.5px] font-normal text-slate-500">
            {t.paymentDayHint}
          </span>
        </label>
        <label className={label}>
          {t.deposit}
          <Input name="deposit" type="number" min={0} step="0.01" dir="ltr" className="mt-1.5" />
        </label>
        <label className={label}>
          {t.notes}
          <Input name="notes" className="mt-1.5" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {listingsT(locale).form.cancel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving}
          data-testid="tenancy-save"
        >
          {t.saveTenancy}
        </Button>
      </div>
    </form>
  );
}

function ActiveTenancy({
  listingId,
  tenancy,
  locale,
  money,
  today,
  canUndo,
}: {
  listingId: string;
  tenancy: Tenancy;
  locale: Locale;
  money: (n: number) => string;
  today: string;
  canUndo: boolean;
}) {
  const t = listingsT(locale).terms;
  const s = tenancy.summary;
  const pct = s.months > 0 ? Math.round((s.paid / s.months) * 100) : 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[12px] font-semibold text-slate-500">{t.tenantName}</p>
          <p className="mt-1 text-[14.5px] font-bold text-slate-900">{tenancy.tenantName}</p>
          <a
            href={`tel:${tenancy.tenantPhone.replace(/[^\d+]/g, '')}`}
            className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-brand-700"
            dir="ltr"
          >
            <Phone className="h-3 w-3" /> {tenancy.tenantPhone}
          </a>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-slate-500">{t.term}</p>
          <p className="mt-1 text-[13.5px] font-bold tabular-nums text-slate-900">
            {formatDate(tenancy.startDate, locale)} — {formatDate(tenancy.endDate, locale)}
          </p>
          <p
            className={cn(
              'mt-0.5 text-[12px]',
              s.endingSoon ? 'font-bold text-amber-700' : 'text-slate-500',
            )}
          >
            {t.endsIn(s.daysLeft)}
          </p>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-slate-500">{t.rent}</p>
          <p className="mt-1 text-[14.5px] font-bold tabular-nums text-slate-900">
            {money(Number(tenancy.monthlyRent))}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {t.payDayOf(tenancy.paymentDay)}
            {tenancy.deposit ? ` · ${t.deposit} ${money(Number(tenancy.deposit))}` : ''}
          </p>
        </div>
      </div>

      {/* How much of the term is paid, and what is late. */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span className="font-semibold text-slate-700">{t.paidMonths(s.paid, s.months)}</span>
          {s.overdueCount > 0 && (
            <Pill tone="rose">
              {t.overdue(s.overdueCount)} · {money(s.overdueAmount)}
            </Pill>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-500/15">
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#E6C77E] to-[#B8913F]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* One row per month — a list, not a table, so it fits a phone. */}
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline text-[13px]">
        {tenancy.schedule.map((row) => (
          <RentLine
            key={row.period}
            listingId={listingId}
            tenancy={tenancy}
            row={row}
            locale={locale}
            money={money}
            today={today}
            canUndo={canUndo}
          />
        ))}
      </ul>
    </div>
  );
}

function RentLine({
  listingId,
  tenancy,
  row,
  locale,
  money,
  today,
  canUndo,
}: {
  listingId: string;
  tenancy: Tenancy;
  row: RentRow;
  locale: Locale;
  money: (n: number) => string;
  today: string;
  canUndo: boolean;
}) {
  const t = listingsT(locale).terms;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState<ListingFormState, FormData>(async (prev, fd) => {
    const res = await recordRentAction(listingId, tenancy.id, row.period, prev, fd);
    if (!res.error) setOpen(false);
    return res;
  }, {});
  const monthName = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${row.period}-01T00:00:00Z`));
  const tone =
    row.state === 'PAID'
      ? 'green'
      : row.state === 'OVERDUE'
        ? 'rose'
        : row.state === 'DUE_TODAY'
          ? 'amber'
          : 'slate';
  const payment = tenancy.payments.find((p) => p.period === row.period);
  return (
    <li
      className={cn('px-4 py-3', row.state === 'OVERDUE' && 'bg-danger-50/40')}
      data-testid={`rent-row-${row.period}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{monthName}</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] tabular-nums text-slate-500">
            <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
            {formatDate(row.dueDate, locale)}
            <span aria-hidden>·</span>
            <span className="font-bold text-slate-700">
              {money(row.paid?.amount ?? row.amount)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={tone}>{t.rowState[row.state]}</Pill>
          {row.state !== 'PAID' && row.state !== 'UPCOMING' && !open && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              data-testid={`rent-record-${row.period}`}
            >
              {t.record}
            </Button>
          )}
          {row.state === 'UPCOMING' && !open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-[12px] font-bold text-brand-700 hover:underline"
            >
              {t.record}
            </button>
          )}
          {payment && canUndo && (
            <button
              type="button"
              aria-label={t.undo}
              title={t.undo}
              disabled={pending}
              onClick={() =>
                window.confirm(t.undoConfirm) &&
                start(() => removeRentPaymentAction(listingId, payment.id))
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-500/10 hover:text-slate-700"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <form
          action={action}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-[#D8B66A]/[0.07] p-3"
          data-testid={`rent-form-${row.period}`}
        >
          <ErrorLine error={state.error} />
          <label className={label}>
            {t.amount}
            <Input
              name="amount"
              type="number"
              required
              min={1}
              step="0.01"
              defaultValue={row.amount}
              dir="ltr"
              className="mt-1 w-36"
            />
          </label>
          <label className={label}>
            {t.paidOn}
            <Input name="paidOn" type="date" required defaultValue={today} className="mt-1" />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {listingsT(locale).form.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              data-testid={`rent-save-${row.period}`}
            >
              {t.save}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
