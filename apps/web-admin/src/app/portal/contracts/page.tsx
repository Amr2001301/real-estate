import Link from 'next/link';
import {
  FileText,
  Eye,
  CheckCircle2,
  FilePen,
  AlertCircle,
  Phone,
  Search,
  Building2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalContract, PortalProject } from '@/lib/types';
import { tx, formatDate, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Avatar, Amount, FigureBar } from '@/components/cockpit/cockpit';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { portalReservationsContractsT } from '@/messages/portal/reservations-contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  projectId?: string;
  signed?: string;
  q?: string;
}

const PAGE_SIZE = 20;

export default async function PortalContractsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalReservationsContractsT(locale);
  const t = m.contracts.list;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.signed === 'yes' || sp.signed === 'no') qs.set('signed', sp.signed);
  if (sp.q) qs.set('q', sp.q);

  const [contractsRes, projectsRes, rAll, rSigned, rPending] = await Promise.all([
    safe(api.get<Paged<PortalContract>>(`/portal/contracts?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalContract>>('/portal/contracts?page=1&pageSize=1')),
    safe(api.get<Paged<PortalContract>>('/portal/contracts?page=1&pageSize=1&signed=yes')),
    safe(api.get<Paged<PortalContract>>('/portal/contracts?page=1&pageSize=1&signed=no')),
  ]);

  const paged        = contractsRes.data;
  const rows         = paged?.data ?? [];
  const projects     = projectsRes.data ?? [];
  const totalAll     = rAll.data?.meta.total     ?? 0;
  const signedCount  = rSigned.data?.meta.total  ?? 0;
  const pendingCount = rPending.data?.meta.total  ?? 0;

  const pageValue = rows.reduce((s, c) => s + Number(c.totalAmount || 0), 0);

  const isFiltered = !!(sp.projectId || sp.signed || sp.q);

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: m.common.contracts },
        ]}
      />

      {contractsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadErrorFn(contractsRes.error)}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: totalAll, href: '/portal/contracts' },
            { label: t.metrics.signed, value: signedCount, href: '/portal/contracts?signed=yes' },
            { label: t.metrics.pending, value: pendingCount, href: '/portal/contracts?signed=no', warn: pendingCount > 0 },
            {
              label: t.pageValue.replace(/:\s*$/, ''),
              value: <Amount parts={compactParts(pageValue, symbol, locale)} />,
            },
          ]}
        />
      </section>

      <PremiumFilterBar
        method="get"
        action="/portal/contracts"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">{t.filter}</Button>
            {isFiltered && (
              <Link href="/portal/contracts">
                <Button type="button" variant="ghost" size="sm">{t.clearFilter}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={t.search}>
          <Input
            inputSize="sm"
            name="q"
            leftAddon={<Search />}
            placeholder={t.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="flex-1 min-w-[180px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label={t.project}>
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-56">
            <option value="">{t.allProjects}</option>
            {projects.map((p) => (
              <option key={p.project.id} value={p.project.id}>
                {tx(p.project.name, locale)}
              </option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.common.status}>
          <Select name="signed" inputSize="sm" defaultValue={sp.signed ?? ''} className="w-44">
            <option value="">{t.allContracts}</option>
            <option value="yes">{t.signedOnly}</option>
            <option value="no">{t.pendingOnly}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        icon={<FileText />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState icon={<FileText />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-contract-rows">
            {rows.map((c) => {
              const clientName = c.customer?.fullName ?? c.reservation?.lead?.fullName ?? '—';
              const phone = c.customer?.phone ?? c.reservation?.lead?.phone;
              const isSigned = !!c.signedAt;
              const href = `/portal/contracts/${c.id}`;
              // Prefer the materialized commission (signed contracts); else the
              // reservation's locked snapshot.
              const comm = c.brokerCommission;
              const pct = comm?.commissionPct ?? c.reservation?.commissionLockedPct;
              const amt = comm?.netAmount ?? c.reservation?.commissionLockedAmount;
              return (
                <li
                  key={c.id}
                  data-testid="portal-contract-row"
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.1fr)_150px_160px_150px_36px]"
                >
                  <Avatar name={clientName} />

                  {/* Client + contract code */}
                  <div className="min-w-0">
                    <Link href={href as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {clientName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                      <Link href={href as never} className="whitespace-nowrap hover:text-brand-700">
                        <span className="me-1 text-slate-400">{locale === 'en' ? 'Contract' : 'عقد'}</span>
                        <span className="font-mono font-semibold text-brand-700" dir="ltr">
                          {c.contractNumber ?? `#${c.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </Link>
                      {phone && (
                        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 tabular-nums hover:text-brand-700">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{phone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Project + unit */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {c.unit?.building ? tx(c.unit.building.phase.project.name, locale) : '—'}
                      </p>
                      {c.unit && (
                        <p className="mt-0.5 text-slate-500">
                          <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span>
                          <span className="whitespace-nowrap font-mono" dir="ltr">{c.unit.code}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contract value */}
                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-400">{t.cols.totalValue}</p>
                    <p className="mt-0.5 whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">
                      <Amount parts={compactParts(Number(c.totalAmount || 0), symbol, locale)} />
                    </p>
                  </div>

                  {/* Commission */}
                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-400">{m.common.lockedCommission}</p>
                    {pct != null ? (
                      <p className="mt-0.5 whitespace-nowrap font-bold tabular-nums text-brand-700">
                        {Number(pct).toFixed(2)}%
                        {amt != null && (
                          <span className="ms-2 text-[12px] font-semibold text-slate-600">
                            <Amount parts={compactParts(Number(amt), symbol, locale)} />
                          </span>
                        )}
                      </p>
                    ) : amt != null ? (
                      <p className="mt-0.5 whitespace-nowrap font-semibold tabular-nums text-slate-700">
                        <span className="me-1 text-[11px] text-slate-400">{t.fixedAmount}</span>
                        <Amount parts={compactParts(Number(amt), symbol, locale)} />
                      </p>
                    ) : (
                      <p className="mt-0.5 text-slate-400">{t.notSet}</p>
                    )}
                  </div>

                  {/* Signature + created */}
                  <div className="hidden flex-col items-start gap-1 lg:flex">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
                        isSigned ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600',
                      )}
                    >
                      {isSigned ? <CheckCircle2 className="h-3 w-3" /> : <FilePen className="h-3 w-3" />}
                      {isSigned ? t.signed : t.pending}
                    </span>
                    <span className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">
                      <bdi>{formatDate(c.createdAt, locale)}</bdi>
                    </span>
                  </div>

                  <Link
                    href={href as never}
                    aria-label={m.common.view}
                    title={m.common.view}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/contracts"
            locale={locale}
            params={{ projectId: sp.projectId, signed: sp.signed, q: sp.q }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
