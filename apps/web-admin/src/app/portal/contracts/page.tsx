import Link from 'next/link';
import {
  FileText,
  Eye,
  CheckCircle2,
  FilePen,
  AlertCircle,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalContract, PortalProject } from '@/lib/types';
import { tx, formatDate, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Amount, FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { DataTable, ListFilterBar, ListFilterField, ListPage, ListPager, ListTableCard, DateText, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { portalReservationsContractsT } from '@/messages/portal/reservations-contracts';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PremiumPageHero,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  projectId?: string;
  signed?: string;
  q?: string;
}

const PAGE_SIZE = 10;

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
  const covers = new Map(projects.map((p) => [p.project.id, p.project.media?.[0]?.url]));
  const totalAll     = rAll.data?.meta.total     ?? 0;
  const signedCount  = rSigned.data?.meta.total  ?? 0;
  const pendingCount = rPending.data?.meta.total  ?? 0;

  const pageValue = rows.reduce((s, c) => s + Number(c.totalAmount || 0), 0);

  const isFiltered = !!(sp.projectId || sp.signed || sp.q);

  return (
    <ListPage minHeight={960}>

      <PremiumPageHero
        className="shrink-0"
        eyebrow={<span className="inline-flex items-center gap-2">{locale === 'ar' ? 'بوابة الوسيط / العقود' : 'Broker portal / Contracts'}<span aria-hidden className="h-px w-6 bg-brand-700/40" /></span>}
        title={t.title}
        description={t.description}
      />

      {contractsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadErrorFn(contractsRes.error)}
        </div>
      )}

      <section className="shrink-0">
        <FigureBar
          variant="cards"
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: totalAll, href: '/portal/contracts', icon: FigIcons.total },
            { label: t.metrics.signed, value: signedCount, href: '/portal/contracts?signed=yes', icon: FigIcons.done, tone: 'green' },
            { label: t.metrics.pending, value: pendingCount, href: '/portal/contracts?signed=no', warn: pendingCount > 0, icon: FigIcons.sign },
            {
              label: t.pageValue.replace(/:\s*$/, ''),
              value: <Amount parts={compactParts(pageValue, symbol, locale)} />,
              icon: FigIcons.money,
              tone: 'blue',
            },
          ]}
        />
      </section>

      <ListFilterBar
        action="/portal/contracts"
        submitLabel={t.filter}
        clearHref={isFiltered ? '/portal/contracts' : undefined}
        clearLabel={t.clearFilter}
      >
        <ListFilterField search label={t.search}>
          <Input name="q" inputSize="sm" placeholder={t.searchPlaceholder} defaultValue={sp.q ?? ''} />
        </ListFilterField>
        <ListFilterField label={t.project}>
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
            <option value="">{t.allProjects}</option>
            {projects.map((p) => (
              <option key={p.project.id} value={p.project.id}>
                {tx(p.project.name, locale)}
              </option>
            ))}
          </Select>
        </ListFilterField>
        <ListFilterField label={m.common.status}>
          <Select name="signed" inputSize="sm" defaultValue={sp.signed ?? ''}>
            <option value="">{t.allContracts}</option>
            <option value="yes">{t.signedOnly}</option>
            <option value="no">{t.pendingOnly}</option>
          </Select>
        </ListFilterField>
      </ListFilterBar>

      <ListTableCard
        title={locale === 'ar' ? 'قائمة العقود' : 'Contracts list'}
        footer={paged && paged.meta.total > 0 ? <ListPager page={paged.meta.page} pageSize={paged.meta.pageSize} total={paged.meta.total} basePath="/portal/contracts" params={{ projectId: sp.projectId, signed: sp.signed, q: sp.q }} locale={locale} /> : undefined}
      >
        {rows.length === 0 ? (
          <EmptyState icon={<FileText />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <DataTable testId="portal-contract-rows">
            <thead>
              <tr>
                <Th>{locale === 'ar' ? 'رقم العقد' : 'Contract'}</Th>
                <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                <Th>{t.cols.totalValue}</Th>
                <Th>{m.common.lockedCommission}</Th>
                <Th>{locale === 'ar' ? 'التوقيع' : 'Signature'}</Th>
                <Th>{locale === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const clientName = c.customer?.fullName ?? c.reservation?.lead?.fullName ?? '—';
                const phone = c.customer?.phone ?? c.reservation?.lead?.phone;
                const isSigned = !!c.signedAt;
                const href = `/portal/contracts/${c.id}`;
                const project = c.unit?.building?.phase?.project;
                // Prefer the materialized commission (signed contracts); else the
                // reservation's locked snapshot.
                const comm = c.brokerCommission;
                const pct = comm?.commissionPct ?? c.reservation?.commissionLockedPct;
                const amt = comm?.netAmount ?? c.reservation?.commissionLockedAmount;
                return (
                  <Tr key={c.id} testId="portal-contract-row">
                    <Td>
                      <Link href={href as never} className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
                        {c.contractNumber ?? `#${c.id.slice(0, 8).toUpperCase()}`}
                      </Link>
                    </Td>
                    <Td>
                      <PersonCell name={clientName} phone={phone} href={href} />
                    </Td>
                    <Td>
                      <UnitCell
                        cover={project ? covers.get(project.id) : undefined}
                        project={project ? tx(project.name, locale) : undefined}
                        unit={c.unit?.code}
                        unitWord={locale === 'en' ? 'Unit:' : 'وحدة:'}
                      />
                    </Td>
                    <Td>
                      <span className="text-[14px] font-bold tabular-nums text-slate-900">
                        <Amount parts={compactParts(Number(c.totalAmount || 0), symbol, locale)} />
                      </span>
                    </Td>
                    <Td>
                      {pct != null || amt != null ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              pct != null
                                ? 'inline-flex min-w-[56px] justify-center rounded-full bg-[#C8A24B]/15 px-2 py-1 text-[12px] font-semibold tabular-nums text-[#8A6823] dark:text-[#E2C792]'
                                : 'inline-flex min-w-[56px] justify-center rounded-full bg-slate-500/12 px-2 py-1 text-[12px] font-semibold text-slate-600'
                            }
                            dir="ltr"
                          >
                            {pct != null ? `${Number(pct).toFixed(2)}%` : t.fixedAmount}
                          </span>
                          {amt != null && (
                            <span className="text-[13px] font-semibold tabular-nums text-slate-800">
                              <Amount parts={compactParts(Number(amt), symbol, locale)} />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">{t.notSet}</span>
                      )}
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                          isSigned ? 'bg-emerald-500/12 text-emerald-700' : 'bg-amber-500/12 text-amber-700',
                        )}
                      >
                        {isSigned ? <CheckCircle2 className="h-3 w-3" /> : <FilePen className="h-3 w-3" />}
                        {isSigned ? t.signed : t.pending}
                      </span>
                    </Td>
                    <Td>
                      <DateText><bdi>{formatDate(c.createdAt, locale)}</bdi></DateText>
                    </Td>
                    <Td>
                      <Link
                        href={href as never}
                        aria-label={m.common.view}
                        title={m.common.view}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        )}

      </ListTableCard>
    </ListPage>
  );
}
