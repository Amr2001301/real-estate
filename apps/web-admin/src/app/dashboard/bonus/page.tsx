import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  BadgePercent, Clock, CheckCircle2, Banknote, Hash,
  AlertCircle, Info, Plus, Undo2, RotateCcw,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import { getSession } from '@/lib/session';
import { getMyCodes } from '@/lib/permissions';
import type { Paged } from '@/lib/types';
import { formatCurrency, formatDate, intlLocale } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/export-menu';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumMetricStrip,
  PremiumEmptyState,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { PersonCell } from '@/components/premium/list-cells';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
type EntryStatus = 'PENDING' | 'APPROVED' | 'PAID';

interface BonusRule {
  id: string;
  name: string;
  percentage: string | number;
  active: boolean;
  autoApplyOnSignedContract?: boolean;
}
type EntrySource = 'MANUAL' | 'CONTRACT_AUTO' | 'ADJUSTMENT';
interface BonusEntry {
  id: string;
  amount: string | number;
  period: string;
  status: EntryStatus;
  paidAt: string | null;
  source?: EntrySource;
  contractId?: string | null;
  sales?: { id: string; fullName: string };
  rule?: { name: string };
}

interface SalesUser {
  id: string;
  fullName: string;
  role?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function buildEntriesUrl(sp: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  if (sp.salesId) p.set('salesId', sp.salesId);
  if (sp.status) p.set('status', sp.status);
  if (sp.period) p.set('period', sp.period);
  const qs = p.toString();
  return `/bonus-entries${qs ? `?${qs}` : ''}`;
}

function redirectBack(formData: FormData, err?: string): never {
  const base = String(formData.get('returnTo') || '/dashboard/bonus');
  if (!err) redirect(base);
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}err=${encodeURIComponent(err)}`);
}

// ── Server actions ─────────────────────────────────────────────────────────
async function createRuleAction(formData: FormData) {
  'use server';
  const res = await safe(
    api.post('/bonus-rules', {
      name: String(formData.get('name') ?? ''),
      percentage: Number(formData.get('percentage') ?? 0),
      autoApplyOnSignedContract: formData.get('autoApplyOnSignedContract') === 'on',
    }),
  );
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

async function toggleRuleAction(
  ruleId: string,
  field: 'active' | 'autoApplyOnSignedContract',
  next: boolean,
  formData: FormData,
) {
  'use server';
  const res = await safe(api.patch(`/bonus-rules/${ruleId}`, { [field]: next }));
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

async function createEntryAction(formData: FormData) {
  'use server';
  const res = await safe(
    api.post('/bonus-entries', {
      salesId: String(formData.get('salesId') ?? ''),
      ruleId: String(formData.get('ruleId') ?? ''),
      amount: Number(formData.get('amount') ?? 0),
      period: String(formData.get('period') ?? ''),
    }),
  );
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

async function entryTransitionAction(
  id: string,
  kind: 'approve' | 'pay' | 'revert',
  formData: FormData,
) {
  'use server';
  const res =
    kind === 'approve'
      ? await safe(api.post(`/bonus-entries/${id}/approve`, {}))
      : kind === 'pay'
        ? await safe(api.post(`/bonus-entries/${id}/pay`, {}))
        : await safe(api.patch(`/bonus-entries/${id}`, { status: 'PENDING' }));
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function BonusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [sp, locale, currency, session, codes] = await Promise.all([
    searchParams,
    getLocale(),
    getReportsCurrency(),
    getSession(),
    getMyCodes(),
  ]);
  // PRM2 — approving and paying stay with the admin; the rules, manual
  // entries and the whole company's export open by their codes.
  const isAdmin = session?.role === 'ADMIN';
  const canRules = codes.has('bonus:rules:manage');
  const canCreate = codes.has('bonus:entries:create');
  const canExport = isAdmin || codes.has('bonus:entries:read:all');
  const m = uiT(locale).bonusPage;
  const symbol = currencySymbol(currency, locale);

  const STATUS_LABEL: Record<EntryStatus, string> = {
    PENDING: m.statusPending,
    APPROVED: m.statusApproved,
    PAID: m.statusPaid,
  };
  const STATUS_CHIP: Record<EntryStatus, string> = {
    PENDING: 'bg-amber-500/12 text-amber-600',
    APPROVED: 'bg-sky-500/12 text-sky-600',
    PAID: 'bg-emerald-500/12 text-emerald-600',
  };
  const STATUS_DOT: Record<EntryStatus, string> = {
    PENDING: 'bg-amber-400',
    APPROVED: 'bg-sky-400',
    PAID: 'bg-emerald-400',
  };
  // "2026-10" → "أكتوبر 2026": the month reads as a word, not a code.
  const monthLabel = (period: string) => {
    const d = new Date(`${period}-01T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? period
      : new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  };
  const SOURCE_LABEL: Record<EntrySource, string> = {
    MANUAL: m.sourceManual,
    CONTRACT_AUTO: m.sourceAuto,
    ADJUSTMENT: m.sourceAdjustment,
  };

  function salesActorLabel(u: SalesUser): string {
    return u.role === 'SALES_MANAGER' ? `${u.fullName} — ${m.roleManager}` : `${u.fullName} — ${m.roleSales}`;
  }

  const [rulesRes, entriesRes, salesRes] = await Promise.all([
    canRules ? safe(api.get<BonusRule[]>('/bonus-rules')) : Promise.resolve({ data: [] as BonusRule[] }),
    safe(api.get<BonusEntry[] | Paged<BonusEntry>>(buildEntriesUrl(sp))),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
  ]);

  const rules = rulesRes.data ?? [];
  const activeAutoRules = rules.filter((r) => r.active && r.autoApplyOnSignedContract);
  const entries = Array.isArray(entriesRes.data)
    ? entriesRes.data
    : (entriesRes.data?.data ?? []);
  const salesUsers = salesRes.data?.data ?? [];

  const sumByStatus = (s: EntryStatus) =>
    entries.filter((e) => e.status === s).reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal = sumByStatus('PAID');

  const returnTo = (() => {
    const p = new URLSearchParams();
    if (sp.salesId) p.set('salesId', sp.salesId);
    if (sp.status) p.set('status', sp.status);
    if (sp.period) p.set('period', sp.period);
    const qs = p.toString();
    return `/dashboard/bonus${qs ? `?${qs}` : ''}`;
  })();

  const hasFilters = !!(sp.salesId || sp.status || sp.period);
  const entryCount = entries.length === 0 ? '0' : entries.length.toLocaleString(intlLocale(locale));

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBonus },
        ]}
        actions={
          canExport ? (
            <ExportMenu locale={locale}
              pdfPath="/bonus-entries/export.pdf"
              xlsxPath="/bonus-entries/export.xlsx"
              csvPath="/bonus-entries/export.csv"
              filenameBase="bonus-entries"
              params={{ salesId: sp.salesId, status: sp.status, period: sp.period }}
            />
          ) : undefined
        }
      />

      {sp.err && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{m.opError}</p>
            <p className="text-xs mt-0.5 opacity-80">{sp.err}</p>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: m.metricPending,  value: pendingTotal === 0 ? `0 ${symbol}` : formatCurrency(pendingTotal, currency, locale),   icon: <Clock />,        tone: 'warning', valueSize: 'compact' },
          { label: m.metricApproved, value: approvedTotal === 0 ? `0 ${symbol}` : formatCurrency(approvedTotal, currency, locale), icon: <CheckCircle2 />, tone: 'info',    valueSize: 'compact' },
          { label: m.metricPaid,     value: paidTotal === 0 ? `0 ${symbol}` : formatCurrency(paidTotal, currency, locale),         icon: <Banknote />,     tone: 'success', valueSize: 'compact' },
          { label: m.metricCount,    value: entryCount,                                                                    icon: <Hash />,         tone: 'brand'   },
        ]}
      />

      {/* Filter bar */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/bonus"
        trailing={
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm">{m.btnFilter}</Button>
            {hasFilters && (
              <Link href="/dashboard/bonus">
                <Button type="button" variant="ghost" size="sm">{m.btnClear}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={m.filterAgent} htmlFor="bonus-sales">
          <Select id="bonus-sales" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-48">
            <option value="">{m.filterAgentAll}</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filterMonth} htmlFor="bonus-period">
          <Input id="bonus-period" name="period" type="month" inputSize="sm" defaultValue={sp.period ?? ''} className="w-40" />
        </PremiumFilterField>
        <PremiumFilterField label={m.filterStatus} htmlFor="bonus-status">
          <Select id="bonus-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-32">
            <option value="">{m.filterStatusAll}</option>
            <option value="PENDING">{m.filterStatusPending}</option>
            <option value="APPROVED">{m.filterStatusApproved}</option>
            <option value="PAID">{m.filterStatusPaid}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* Entries table */}
      <PremiumSectionCard
        title={m.sectionEntries}
        trailing={<span className="text-xs text-slate-400 tabular-nums">{entryCount} {m.entriesCount}</span>}
        padded={false}
      >
        {entriesRes.error ? (
          <div className="flex items-start gap-2 m-5 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{entriesRes.error}</p>
          </div>
        ) : entries.length === 0 ? (
          <PremiumEmptyState
            icon={<BadgePercent />}
            title={m.emptyTitle}
            description={hasFilters ? m.emptyDescFiltered : m.emptyDescNone}
            action={
              hasFilters ? (
                <Link href="/dashboard/bonus">
                  <Button variant="outline" size="sm">{m.btnClearFilters}</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]" data-testid="bonus-table">
              <thead className="bg-surface-muted/50 border-b border-hairline">
                <tr>
                  <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap ps-5">{m.colAgent}</th>
                  <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap">{m.colRule}</th>
                  <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap">{m.colAmount}</th>
                  <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap">{m.colStatus}</th>
                  <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap pe-5 text-end">{m.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entries.map((e) => (
                  <tr key={e.id} className="group hover:bg-brand-500/[0.04] transition-colors duration-100">
                    <td className="ps-5 pe-4 py-3.5">
                      {/* The month rides under the name, as a word */}
                      <PersonCell name={e.sales?.fullName ?? '—'} sub={monthLabel(e.period)} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="min-w-[200px] max-w-[300px]">
                        <p className="truncate text-[13px] font-semibold text-slate-800" title={e.rule?.name}>{e.rule?.name ?? '—'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                            e.source === 'CONTRACT_AUTO' ? 'bg-sky-500/12 text-sky-600' : 'bg-slate-500/10 text-slate-500',
                          )}>
                            {SOURCE_LABEL[e.source ?? 'MANUAL']}
                          </span>
                          {e.contractId && (
                            <Link
                              href={`/dashboard/contracts/${e.contractId}` as never}
                              className="text-[11px] font-semibold text-brand-700 hover:underline underline-offset-2"
                            >
                              {m.viewContract}
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[14px] font-bold tabular-nums text-slate-900">
                        {formatCurrency(e.amount, currency, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold', STATUS_CHIP[e.status])}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[e.status])} />
                        {STATUS_LABEL[e.status]}
                      </span>
                      {e.paidAt && (
                        <p className="mt-1 text-[11px] tabular-nums text-slate-500">{formatDate(e.paidAt, locale)}</p>
                      )}
                    </td>
                    <td className="ps-4 pe-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {isAdmin && e.status === 'PENDING' && (
                          <form action={entryTransitionAction.bind(null, e.id, 'approve')}>
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button type="submit" className={pill('brand')}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {m.btnApprove}
                            </button>
                          </form>
                        )}
                        {isAdmin && e.status === 'APPROVED' && (
                          <form action={entryTransitionAction.bind(null, e.id, 'pay')}>
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button type="submit" className={pill('success')}>
                              <Banknote className="h-3.5 w-3.5" />
                              {m.btnMarkPaid}
                            </button>
                          </form>
                        )}
                        {isAdmin && e.status !== 'PENDING' && (
                          <form action={entryTransitionAction.bind(null, e.id, 'revert')}>
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button
                              type="submit"
                              title={m.btnRevertPending}
                              aria-label={m.btnRevertPending}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-amber-500/10 hover:text-amber-600"
                            >
                              {e.status === 'PAID' ? <RotateCcw className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>
      {/* Rules and manual entry side by side, under the records */}
      {(canRules || canCreate) && (
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5 items-stretch">
        {/* Commission rules */}
        {canRules && (
        <PremiumSectionCard
          title={m.sectionRules}
          icon={<BadgePercent />}
          trailing={<span className="text-xs text-slate-400 tabular-nums">{rules.length} {m.rulesCount}</span>}
          padded={false}
          className="h-full"
        >
          {/* Auto-rule status banner */}
          <div className={cn(
            'mx-5 mt-4 rounded-xl px-3.5 py-2.5 text-[12px] border flex items-center gap-2',
            activeAutoRules.length === 0
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-600'
              : activeAutoRules.length === 1
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600'
                : 'bg-danger-500/10 border-danger-500/25 text-danger-600',
          )}>
            {activeAutoRules.length === 1
              ? <Info className="h-3.5 w-3.5 shrink-0" />
              : <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            }
            <span>
              {activeAutoRules.length === 0
                ? m.autoRuleNone
                : activeAutoRules.length === 1
                  ? `${m.autoRuleOk}: ${activeAutoRules[0]!.name}`
                  : m.autoRuleMultiple}
            </span>
          </div>

          {/* Rules list */}
          {rules.length > 0 ? (
            <ul className="mt-3 px-5 divide-y divide-hairline">
              {rules.map((r) => {
                const isAmbiguous = activeAutoRules.length > 1 && r.active && r.autoApplyOnSignedContract;
                return (
                  <li
                    key={r.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 py-3.5 transition-opacity',
                      !r.active && 'opacity-50',
                      isAmbiguous && 'bg-danger-500/[0.06] -mx-2 px-2 rounded-xl',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-700/15 text-[13px] font-bold tabular-nums text-brand-700 ring-1 ring-brand-500/30" dir="ltr">
                        {Number(r.percentage)}%
                      </span>
                      <span className="text-[14px] font-bold text-slate-900 truncate">{r.name}</span>
                      {r.autoApplyOnSignedContract && (
                        <span className="shrink-0 rounded-full bg-sky-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600">{m.badgeAutoSign}</span>
                      )}
                      {!r.active && (
                        <span className="shrink-0 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{m.badgeStopped}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <form action={toggleRuleAction.bind(null, r.id, 'active', !r.active)}>
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button type="submit" className={pill(r.active ? 'ghost' : 'success')}>
                          {r.active ? m.btnStop : m.btnActivate}
                        </button>
                      </form>
                      <form action={toggleRuleAction.bind(null, r.id, 'autoApplyOnSignedContract', !r.autoApplyOnSignedContract)}>
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button type="submit" className={pill(r.autoApplyOnSignedContract ? 'ghost' : 'brand')}>
                          {r.autoApplyOnSignedContract ? m.btnCancelAuto : m.btnActivateAuto}
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-4 text-[12px] text-slate-400">{m.noRules}</p>
          )}

          {/* Add rule footer */}
          <div className="border-t border-hairline bg-surface-muted/30 px-5 py-4 mt-1">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-800">
              <Plus className="h-4 w-4 text-brand-700" />
              {m.addRuleTitle}
            </p>
            <form action={createRuleAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="flex flex-wrap items-center gap-2">
                <Input name="name" required placeholder={m.addRuleNamePlaceholder} inputSize="sm" className="flex-1 min-w-[160px]" />
                <Input name="percentage" type="number" step="any" min={0} required inputSize="sm" placeholder={m.addRulePercentPlaceholder} className="w-28" />
                <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  {m.btnAddRule}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-slate-600 mt-2.5 cursor-pointer">
                <input type="checkbox" name="autoApplyOnSignedContract" className="rounded border-hairline" />
                {m.addRuleAutoLabel}
              </label>
            </form>
            <p className="text-[11px] text-slate-400 mt-2.5">
              {m.addRuleNote}
            </p>
          </div>
        </PremiumSectionCard>
        )}
        {/* Manual entry */}
        {canCreate && (
        <PremiumSectionCard title={m.sectionManualEntry} icon={<Plus />} className="h-full">
          {rules.length === 0 || salesUsers.length === 0 ? (
            <p className="text-[12px] text-slate-400">
              {m.manualEntryNoData}
            </p>
          ) : (
            <form action={createEntryAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="grid grid-cols-2 gap-4 items-end">
                <FormField label={m.fieldAgent}>
                  <Select id="be-salesId" name="salesId" inputSize="sm" required className="w-full">
                    {salesUsers.map((u) => (
                      <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={m.fieldRule}>
                  <Select id="be-ruleId" name="ruleId" inputSize="sm" required className="w-full">
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={`${m.colAmount} (${symbol})`}>
                  <Input id="be-amount" name="amount" type="number" step="any" min={0} required inputSize="sm" className="w-full" placeholder="0" />
                </FormField>
                <FormField label={m.fieldMonth}>
                  <Input id="be-period" name="period" type="month" required inputSize="sm" className="w-full" />
                </FormField>
                <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} className="col-span-2 justify-center">
                  {m.btnAddEntry}
                </Button>
              </div>
            </form>
          )}
        </PremiumSectionCard>
        )}
      </div>
      )}
    </div>
  );
}

const PILL_TONE = {
  brand:   'border-brand-500/40 bg-brand-500/10 text-brand-700 hover:bg-brand-500/20',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
  ghost:   'border-hairline text-slate-500 hover:text-slate-800',
} as const;

/** Compact row action: the table stays calm, the next step still stands out. */
function pill(tone: keyof typeof PILL_TONE): string {
  return `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${PILL_TONE[tone]}`;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-semibold text-slate-500">{label}</p>
      {children}
    </div>
  );
}
