import Link from 'next/link';
import { Plus, FileText, Eye, Phone, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged } from '@/lib/types';
import { formatCurrency, formatDate, intlLocale, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

interface ContractRow {
  id: string;
  contractNumber: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  signedAt: string | null;
  createdAt: string;
  customer: { id: string; fullName: string; phone: string | null } | null;
  unit: {
    id: string;
    code: string;
    type: string;
    building?: {
      phase?: {
        project?: { id: string; name: { ar: string; en: string } } | null;
      } | null;
    } | null;
  } | null;
  reservation: { id: string; reservationNumber: string | null } | null;
  installmentPlan: {
    id: string;
    totalMonths: number;
    monthlyAmount: string | number;
  } | null;
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    signed?: string;
    hasReservation?: string;
    deliveryDelayed?: string;
    page?: string;
  }>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).pages.contracts;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.signed) qs.set('signed', sp.signed);
  if (sp.hasReservation) qs.set('hasReservation', sp.hasReservation);
  if (sp.deliveryDelayed === 'true') qs.set('deliveryDelayed', 'true');

  // One wave. getReportsCurrency() used to run before the contract fetches and
  // getSession() after them, so a render that needs no ordering at all cost
  // three sequential round trips. Nothing here depends on anything else here:
  // currency and session only feed display and a role check.
  const [currency, contractsRes, allRes, signedRes, delayedRes, session] = await Promise.all([
    getReportsCurrency(),
    safe(api.get<Paged<ContractRow>>(`/contracts?${qs}`)),
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1')),
    // Company-wide counts (the old strip counted only the current page).
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1&signed=yes')),
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1&deliveryDelayed=true')),
    getSession(),
  ]);

  const contracts = contractsRes.data?.data ?? [];
  const meta = contractsRes.data?.meta;
  const totalContracts = allRes.data?.meta.total ?? 0;

  const signedCount = signedRes.data?.meta.total;
  const delayedCount = delayedRes.data?.meta.total;

  // Manual contract creation (contracts:upload) is ADMIN-only; SALES reads.
  const isAdmin = session?.role === 'ADMIN';

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          isAdmin ? (
            <Link href="/dashboard/contracts/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addBtn}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── Figures ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.figures.total, value: totalContracts, href: '/dashboard/contracts' },
            { label: m.figures.signed, value: signedCount ?? '—', href: '/dashboard/contracts?signed=yes' },
            {
              label: m.figures.unsigned,
              value: signedCount === undefined ? '—' : totalContracts - signedCount,
              href: '/dashboard/contracts?signed=no',
              warn: signedCount !== undefined && totalContracts - signedCount > 0,
            },
            { label: m.figures.delayed, value: delayedCount ?? '—', href: '/dashboard/contracts?deliveryDelayed=true', warn: (delayedCount ?? 0) > 0 },
          ]}
        />
      </section>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/contracts">
        {/* Search */}
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="con-q" className="sr-only">{m.filter.searchLabel}</label>
          <Input
            id="con-q"
            name="q"
            inputSize="sm"
            placeholder={m.filter.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="w-full"
          />
        </div>

        <PremiumFilterField label={m.filter.signedLabel} htmlFor="con-signed">
          <Select id="con-signed" name="signed" inputSize="sm" defaultValue={sp.signed ?? ''} className="w-36 shrink-0">
            <option value="">{m.filter.allSigned}</option>
            <option value="yes">{m.filter.signed}</option>
            <option value="no">{m.filter.unsigned}</option>
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label={m.filter.sourceLabel} htmlFor="con-hasReservation">
          <Select id="con-hasReservation" name="hasReservation" inputSize="sm" defaultValue={sp.hasReservation ?? ''} className="w-36 shrink-0">
            <option value="">{m.filter.allSources}</option>
            <option value="yes">{m.filter.fromReservation}</option>
            <option value="no">{m.filter.manual}</option>
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label={m.filter.deliveryLabel} htmlFor="con-delivery">
          <Select id="con-delivery" name="deliveryDelayed" inputSize="sm" defaultValue={sp.deliveryDelayed ?? ''} className="w-40 shrink-0">
            <option value="">{m.filter.deliveryAll}</option>
            <option value="true">{m.filter.deliveryDelayed}</option>
          </Select>
        </PremiumFilterField>

        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {(sp.q || sp.signed || sp.hasReservation || sp.deliveryDelayed) && (
            <Link href="/dashboard/contracts">
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {contractsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {contractsRes.error}
        </div>
      )}

      {/* ── Rows ─────────────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        title={m.title}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {(meta?.total ?? contracts.length).toLocaleString(intlLocale(locale))} {m.countSuffix}
          </span>
        }
      >
        {contracts.length === 0 ? (
          <PremiumEmptyState icon={<FileText />} title={m.empty} />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="contract-rows">
            {contracts.map((c) => {
              const name = c.customer?.fullName ?? '—';
              const href = `/dashboard/contracts/${c.id}`;
              const project = c.unit?.building?.phase?.project;
              return (
                <li
                  key={c.id}
                  data-testid="contract-row"
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.1fr)_170px_minmax(0,1fr)_150px_36px]"
                >
                  <Avatar name={name} />

                  {/* Client + contract code */}
                  <div className="min-w-0">
                    <Link href={href as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                      <Link href={href as never} data-testid="list-code" className="whitespace-nowrap hover:text-brand-700">
                        <span className="me-1 text-slate-400">{m.contractWord}</span>
                        <span className="font-mono font-semibold text-brand-700" dir="ltr">
                          {c.contractNumber ?? `#${c.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </Link>
                      {c.customer?.phone && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{c.customer.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project + unit */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{project ? tx(project.name) : '—'}</p>
                      {c.unit && (
                        <p className="mt-0.5 text-slate-500">
                          <span className="me-1 text-slate-400">{m.unitWord}</span>
                          <span className="whitespace-nowrap font-mono" dir="ltr">{c.unit.code}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total + down payment */}
                  <div className="hidden text-[12.5px] tabular-nums lg:block">
                    <p className="whitespace-nowrap text-[15px] font-bold text-slate-900">{formatCurrency(c.totalAmount, currency, locale)}</p>
                    {Number(c.downPayment) > 0 && (
                      <p className="mt-0.5 whitespace-nowrap text-slate-500">{m.downPaymentPrefix} {formatCurrency(c.downPayment, currency, locale)}</p>
                    )}
                  </div>

                  {/* Plan + source */}
                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    <p className={cn('truncate font-semibold', c.installmentPlan ? 'text-slate-800' : 'text-slate-400')}>
                      {c.installmentPlan
                        ? <>{c.installmentPlan.totalMonths} {m.monthsSuffix} · <span className="tabular-nums">{formatCurrency(c.installmentPlan.monthlyAmount, currency, locale)}</span> {m.perMonth}</>
                        : m.noPlan}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {c.reservation ? (
                        <Link href={`/dashboard/reservations/${c.reservation.id}` as never} className="whitespace-nowrap hover:text-brand-700">
                          <span className="me-1 text-slate-400">{m.reservationWord}</span>
                          <span className="font-mono" dir="ltr">{c.reservation.reservationNumber ?? c.reservation.id.slice(0, 8)}</span>
                        </Link>
                      ) : (
                        m.manualBadge
                      )}
                    </p>
                  </div>

                  {/* Signature */}
                  <div className="hidden flex-col items-start gap-1 lg:flex">
                    {c.signedAt ? (
                      <span className="whitespace-nowrap rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-600">
                        {m.signedOn} {formatDate(c.signedAt, locale)}
                      </span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-amber-500/12 px-2.5 py-1 text-[11.5px] font-semibold text-amber-600">{m.unsignedLabel}</span>
                    )}
                    <span className="whitespace-nowrap text-[11.5px] text-slate-500">{m.createdOn} {formatDate(c.createdAt, locale)}</span>
                  </div>

                  <Link
                    href={href as never}
                    aria-label={m.viewBtn}
                    title={m.viewBtn}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {meta && (
        <Pagination
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          basePath="/dashboard/contracts"
          params={{ q: sp.q, signed: sp.signed, hasReservation: sp.hasReservation, deliveryDelayed: sp.deliveryDelayed }}
          locale={locale}
        />
      )}
    </div>
  );
}
