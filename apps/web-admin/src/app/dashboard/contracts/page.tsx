import Link from 'next/link';
import { Plus, FileText, CheckCircle2, Link2, Unlink, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/table';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
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
    page?: string;
  }>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).pages.contracts;
  const sp = await searchParams;
  const currency = await getReportsCurrency();
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.signed) qs.set('signed', sp.signed);
  if (sp.hasReservation) qs.set('hasReservation', sp.hasReservation);

  const [contractsRes, allRes] = await Promise.all([
    safe(api.get<Paged<ContractRow>>(`/contracts?${qs}`)),
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1')),
  ]);

  const contracts = contractsRes.data?.data ?? [];
  const meta = contractsRes.data?.meta;
  const totalContracts = allRes.data?.meta.total ?? 0;

  // Derive KPI counts from current filtered set for signed / reservation stats
  // (approximate — full count would need a dedicated stats endpoint)
  const signedCount = contracts.filter((c) => c.signedAt).length;
  const withReservationCount = contracts.filter((c) => c.reservation).length;

  // Manual contract creation (contracts:upload) is ADMIN-only; SALES reads.
  const session = await getSession();
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

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={3}
        metrics={[
          {
            label: m.kpi.total,
            value: totalContracts,
            icon: <FileText />,
            tone: 'brand',
            primary: true,
          },
          {
            label: m.kpi.signed,
            value: signedCount,
            icon: <CheckCircle2 />,
            tone: 'success',
            sub: m.kpi.signedSub.replace('{n}', String(contracts.length)),
          },
          {
            label: m.kpi.fromReservation,
            value: withReservationCount,
            icon: <Link2 />,
            tone: 'info',
            sub: m.kpi.signedSub.replace('{n}', String(contracts.length)),
          },
        ]}
      />

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

        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {(sp.q || sp.signed || sp.hasReservation) && (
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

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <DataTable
        rowKey={(c) => c.id}
        rows={contracts}
        emptyMessage={m.empty}
        columns={[
          {
            key: 'number',
            header: m.cols.id,
            cell: (c) => (
              <Link
                href={`/dashboard/contracts/${c.id}`}
                title={m.viewBtn}
                className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
              >
                {c.contractNumber ?? c.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            key: 'customer',
            header: m.cols.client,
            cell: (c) => (
              <div>
                <p className="font-medium text-slate-900">{c.customer?.fullName ?? '—'}</p>
                {c.customer?.phone && (
                  <p className="text-xs text-slate-500 font-mono" dir="ltr">{c.customer.phone}</p>
                )}
              </div>
            ),
          },
          {
            key: 'unit',
            header: m.cols.unit,
            cell: (c) => (
              <div>
                <p className="font-medium">{c.unit?.code ?? '—'} · {c.unit?.type ?? ''}</p>
                <p className="text-xs text-slate-400">
                  {tx(c.unit?.building?.phase?.project?.name) || '—'}
                </p>
              </div>
            ),
          },
          {
            key: 'amounts',
            header: m.cols.total,
            cell: (c) => (
              <div className="tabular-nums text-sm">
                <p className="font-semibold">{formatCurrency(c.totalAmount, currency)}</p>
                {Number(c.downPayment) > 0 && (
                  <p className="text-xs text-slate-400">{m.downPaymentPrefix} {formatCurrency(c.downPayment, currency)}</p>
                )}
              </div>
            ),
          },
          {
            key: 'plan',
            header: m.cols.plan,
            cell: (c) =>
              c.installmentPlan ? (
                <span className="inline-flex items-center gap-1 text-xs text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  {c.installmentPlan.totalMonths} {m.monthsSuffix}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              ),
          },
          {
            key: 'source',
            header: m.cols.source,
            cell: (c) =>
              c.reservation ? (
                <Link
                  href={`/dashboard/reservations/${c.reservation.id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                >
                  <Link2 className="h-3 w-3" />
                  {c.reservation.reservationNumber ?? c.reservation.id.slice(0, 8)}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Unlink className="h-3 w-3" />
                  {m.manualBadge}
                </span>
              ),
          },
          {
            key: 'signed',
            header: m.cols.signed,
            cell: (c) =>
              c.signedAt ? (
                <span className="text-xs text-success-700">{formatDate(c.signedAt)}</span>
              ) : (
                <span className="text-xs text-slate-400">{m.unsignedLabel}</span>
              ),
          },
          {
            key: 'created',
            header: m.cols.created,
            cell: (c) => <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            cell: (c) => (
              <Link href={`/dashboard/contracts/${c.id}`}>
                <IconButton label={m.viewBtn} variant="outline" size="sm">
                  <Eye />
                </IconButton>
              </Link>
            ),
          },
        ]}
      />

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {meta && (
        <Pagination
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          basePath="/dashboard/contracts"
          params={{ q: sp.q, signed: sp.signed, hasReservation: sp.hasReservation }}
          locale={locale}
        />
      )}
    </div>
  );
}
