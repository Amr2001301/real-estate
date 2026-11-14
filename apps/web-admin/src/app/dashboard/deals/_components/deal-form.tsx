'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, Building, Home, KeyRound, UserRound } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import type { StaffOption } from '@/lib/options';
import { formatExactCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { SearchSelect } from '@/components/form/search-select';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { listingsT, LISTING_KINDS, type Listing, type ListingKind } from '@/components/listings/messages';
import { dealsT, type CommissionRule } from '@/components/deals/messages';
import { createDealAction, type DealFormState } from '../actions';

const KIND_ICON: Record<ListingKind, typeof Building> = { PRIMARY: Building, RESALE: Home, RENT: KeyRound };
const round2 = (n: number) => Math.round(n * 100) / 100;

interface LeadOption {
  id: string;
  fullName: string;
  phone: string;
}

/** Record a closed deal: the listing, the customer, the money and who closed it. */
export function DealForm({
  locale,
  currency,
  today,
  listings,
  rules,
  agents,
  selfName,
  initialListingId,
  mandatePct,
  projectPct = {},
}: {
  locale: Locale;
  currency: string;
  today: string;
  listings: Listing[];
  rules: CommissionRule[];
  /** null: the caller records as themself (a rep). */
  agents: StaffOption[] | null;
  selfName: string;
  initialListingId: string;
  mandatePct: number | null;
  /** BRK-5: the commission agreed per directory project. */
  projectPct?: Record<string, number>;
}) {
  const m = dealsT(locale);
  const f = m.form;
  const lm = listingsT(locale);
  const label = 'block text-[12.5px] font-semibold text-slate-600';
  const hint = 'mt-1 block text-[11.5px] font-normal text-slate-500';
  const [state, formAction, pending] = useActionState<DealFormState, FormData>(createDealAction, {});

  const [listingId, setListingId] = useState(initialListingId);
  const listing = listings.find((l) => l.id === listingId) ?? null;
  const [pickedKind, setPickedKind] = useState<ListingKind>('RESALE');
  const kind = listing?.kind ?? pickedKind;
  const [lead, setLead] = useState<LeadOption | null>(null);
  const [agentId, setAgentId] = useState(listing?.agentId ?? '');

  const agreedPct = (l: Listing | null) => (l?.developerProjectId ? projectPct[l.developerProjectId] ?? null : null);
  const startPct = listingId === initialListingId && mandatePct ? mandatePct : agreedPct(listing) ?? (listing?.kind === 'RENT' ? null : 2.5);
  const [value, setValue] = useState(listing ? String(Number(listing.price)) : '');
  const [pct, setPct] = useState(startPct ? String(startPct) : '');
  const [commission, setCommission] = useState(listing && startPct ? String(round2((Number(listing.price) * startPct) / 100)) : '');

  function pickListing(id: string) {
    setListingId(id);
    const l = listings.find((x) => x.id === id);
    if (!l) return;
    setValue(String(Number(l.price)));
    if (l.agentId) setAgentId(l.agentId);
    const agreed = agreedPct(l);
    if (agreed !== null) setPct(String(agreed));
    const p = agreed ?? Number(pct);
    if (p > 0) setCommission(String(round2((Number(l.price) * p) / 100)));
  }
  function onValue(v: string) {
    setValue(v);
    const p = Number(pct);
    if (p > 0 && Number(v) > 0) setCommission(String(round2((Number(v) * p) / 100)));
  }
  function onPct(v: string) {
    setPct(v);
    if (Number(v) >= 0 && Number(value) > 0) setCommission(v === '' ? '' : String(round2((Number(value) * Number(v)) / 100)));
  }
  function onCommission(v: string) {
    setCommission(v);
    setPct(Number(value) > 0 && v !== '' ? String(round2((Number(v) / Number(value)) * 100)) : '');
  }

  const rule = rules.find((r) => r.kind === kind);
  const total = Number(commission) || 0;
  const money = (n: number) => formatExactCurrency(n, currency, locale);
  const preview = useMemo(() => {
    if (!rule || (rule.agentPct === 0 && rule.managerPct === 0)) return null;
    const agent = round2((total * rule.agentPct) / 100);
    const manager = round2((total * rule.managerPct) / 100);
    return { agent, manager, company: round2(total - agent - manager) };
  }, [rule, total]);

  const nav = [
    { id: 'listing', num: '01', label: f.sListing, sub: listing ? listing.code : lm.kind[kind] },
    { id: 'customer', num: '02', label: f.sCustomer, sub: lead?.fullName ?? f.customerName },
    { id: 'money', num: '03', label: f.sMoney, sub: total > 0 ? money(total) : f.commissionTotal },
    { id: 'team', num: '04', label: f.sTeam, sub: f.agent },
  ];

  return (
    <form action={formAction} data-testid="deal-form">
      <PremiumFormLayout navSections={nav} locale={locale} sidebarTitle={f.title} sidebarBadge={lm.kind[kind]} sidebarInfo={f.desc}>
        {state.error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-500/10 px-4 py-3 text-[13px] font-medium text-danger-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </p>
        )}

        <PremiumFormPanel id="listing" number="01" title={f.sListing} description={f.sListingDesc}>
          <div className="space-y-5">
            <label className={label}>
              {f.listing}
              <Select name="listingId" value={listingId} onChange={(e) => pickListing(e.target.value)} className="mt-1.5" data-testid="deal-listing">
                <option value="">{f.noListingOption}</option>
                {LISTING_KINDS.map((k) => {
                  const group = listings.filter((l) => l.kind === k);
                  if (!group.length) return null;
                  return (
                    <optgroup key={k} label={lm.kind[k]}>
                      {group.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} — {l.title}
                          {l.status === 'CLOSED' ? ` (${lm.closed[l.kind]})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
            </label>

            {listing ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D8B66A]/40 bg-[#D8B66A]/[0.06] p-4" data-testid="deal-listing-card">
                <div className="flex min-w-0 items-center gap-3">
                  {(() => {
                    const Icon = KIND_ICON[listing.kind];
                    return (
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B66A]/60 bg-[#0E1626] text-[#E6C77E]">
                        <Icon className="h-[18px] w-[18px] stroke-[1.6]" />
                      </span>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-slate-900">{listing.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {listing.code} · {lm.kind[listing.kind]}
                      {listing.developerName ? ` · ${listing.developerName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-[11.5px] text-slate-500">{f.price}</p>
                  <p className="num text-[15px] font-bold text-slate-900">{formatExactCurrency(listing.price, currency, locale)}</p>
                </div>
              </div>
            ) : (
              <div>
                <span className={label}>{f.kind}</span>
                <input type="hidden" name="kind" value={pickedKind} />
                <div role="radiogroup" className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {LISTING_KINDS.map((k) => {
                    const Icon = KIND_ICON[k];
                    const on = pickedKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-testid={`deal-kind-${k}`}
                        onClick={() => setPickedKind(k)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border p-3.5 text-start transition-all',
                          on ? 'border-[#D8B66A] bg-[#D8B66A]/[0.08]' : 'border-hairline hover:border-[#D8B66A]/50',
                        )}
                      >
                        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', on ? 'border-[#D8B66A]/60 bg-[#0E1626] text-[#E6C77E]' : 'border-hairline text-slate-500')}>
                          <Icon className="h-4 w-4 stroke-[1.6]" />
                        </span>
                        <span className="text-[13.5px] font-bold text-slate-900">{lm.kind[k]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {kind === 'PRIMARY' && (
              <label className={label}>
                {f.developer}
                <Input
                  key={listing?.id ?? 'none'}
                  name="developerName"
                  required
                  minLength={2}
                  defaultValue={listing?.developerName ?? ''}
                  className="mt-1.5"
                  data-testid="deal-developer"
                />
                <span className={hint}>{f.developerHint}</span>
              </label>
            )}
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="customer" number="02" title={f.sCustomer} description={f.sCustomerDesc}>
          <div className="space-y-5">
            <div className={label}>
              {f.lead}
              <div className="mt-1.5">
                <SearchSelect<LeadOption>
                  name="leadId"
                  endpoint="/api-proxy/leads"
                  toOption={(l) => ({ id: l.id, label: `${l.fullName} — ${l.phone}`, raw: l })}
                  onChange={setLead}
                  placeholder={f.leadPlaceholder}
                  locale={locale}
                />
              </div>
            </div>
            {!lead && (
              <>
                <p className="flex items-center gap-3 text-[12px] font-semibold text-slate-400">
                  <span className="h-px flex-1 bg-hairline" />
                  {f.orWalkIn}
                  <span className="h-px flex-1 bg-hairline" />
                </p>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className={label}>
                    {f.customerName}
                    <Input name="customerName" required minLength={2} maxLength={120} className="mt-1.5" data-testid="deal-customer-name" />
                  </label>
                  <label className={label}>
                    {f.customerPhone}
                    <Input name="customerPhone" type="tel" dir="ltr" pattern="^\+?[0-9 ()\-]{6,20}$" className="mt-1.5" />
                  </label>
                </div>
              </>
            )}
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="money" number="03" title={f.sMoney} description={f.sMoneyDesc}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className={label}>
              {kind === 'RENT' ? f.dealValueRent : f.dealValue}
              <Input name="dealValue" type="number" required min={1} step="0.01" dir="ltr" value={value} onChange={(e) => onValue(e.target.value)} className="mt-1.5" data-testid="deal-value" />
            </label>
            <label className={label}>
              {f.closedOn}
              <Input name="closedOn" type="date" required max={today} defaultValue={today} className="mt-1.5" />
            </label>
            <label className={label}>
              {f.commissionPct}
              <Input type="number" min={0} max={100} step="0.01" dir="ltr" value={pct} onChange={(e) => onPct(e.target.value)} className="mt-1.5" data-testid="deal-pct" />
              {listingId === initialListingId && mandatePct ? (
                <span className={hint}>{f.fromMandate(mandatePct)}</span>
              ) : agreedPct(listing) !== null ? (
                <span className={hint}>{f.fromDeveloper(agreedPct(listing)!)}</span>
              ) : null}
            </label>
            <label className={label}>
              {f.commissionTotal}
              <Input name="commissionTotal" type="number" required min={0} step="0.01" dir="ltr" value={commission} onChange={(e) => onCommission(e.target.value)} className="mt-1.5" data-testid="deal-commission" />
            </label>
          </div>

          {/* The split, as the company's rule will make it. */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#D8B66A]/[0.28] bg-navy-band p-5 text-[#F4ECD8]" data-testid="deal-preview">
            <p className="text-[12.5px] font-semibold text-[#A9B0BD]">{f.preview}</p>
            {preview ? (
              <dl className="mt-3 grid grid-cols-3 gap-3">
                {[
                  [m.role.AGENT, preview.agent, rule!.agentPct],
                  [f.previewManager, preview.manager, rule!.managerPct],
                  [f.previewCompany, preview.company, round2(100 - rule!.agentPct - rule!.managerPct)],
                ].map(([k, v, p]) => (
                  <div key={String(k)} className="min-w-0">
                    <dt className="truncate text-[11.5px] text-[#A9B0BD]">{k}</dt>
                    <dd className="num mt-1 text-[15px] font-bold sm:text-[17px]">{money(Number(v))}</dd>
                    <dd className="num text-[11.5px] text-[#D8B66A]">{p}%</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-[13px] text-[#C9CED8]">
                {f.previewNone}{' '}
                <Link href={'/dashboard/deals/rules' as never} className="font-bold text-[#E6C77E] underline-offset-4 hover:underline">
                  {m.tabs.rules}
                </Link>
              </p>
            )}
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="team" number="04" title={f.sTeam} description={f.sTeamDesc}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {agents ? (
              <label className={label}>
                {f.agent}
                <Select name="agentId" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1.5" data-testid="deal-agent">
                  <option value="">{f.noAgent}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <div className={label}>
                {f.agent}
                <p className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-hairline bg-surface-muted/40 px-3 text-[14px] font-bold text-slate-900">
                  <UserRound className="h-4 w-4 text-brand-700" aria-hidden /> {selfName}
                </p>
              </div>
            )}
            <label className={cn(label, 'md:col-span-2')}>
              {f.notes}
              <Textarea name="notes" rows={3} maxLength={2000} className="mt-1.5" />
            </label>
          </div>
        </PremiumFormPanel>

        <FormFooter
          sticky
          secondary={
            <Link href={'/dashboard/deals' as never}>
              <Button type="button" variant="ghost" size="md">{f.cancel}</Button>
            </Link>
          }
          primary={
            <Button type="submit" variant="primary" size="md" disabled={pending} data-testid="deal-save">
              {f.save}
            </Button>
          }
        />
      </PremiumFormLayout>
    </form>
  );
}
