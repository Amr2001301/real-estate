import Link from 'next/link';
import { Plus, FileText, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Project } from '@/lib/types';
import { formatCurrency, formatDate, intlLocale, tx } from '@/lib/format';
import { FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { DataTable, DateText, ListFilterBar, ListFilterField, ListPage, ListPager, ListTableCard, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
import { EntityLink } from '@/components/entity-link';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  PremiumPageHero,
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
  const pageSize = 10;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.signed) qs.set('signed', sp.signed);
  if (sp.hasReservation) qs.set('hasReservation', sp.hasReservation);
  if (sp.deliveryDelayed === 'true') qs.set('deliveryDelayed', 'true');

  // One wave. getReportsCurrency() used to run before the contract fetches and
  // getSession() after them, so a render that needs no ordering at all cost
  // three sequential round trips. Nothing here depends on anything else here:
  // currency and session only feed display and a role check.
  const [currency, contractsRes, allRes, signedRes, delayedRes, session, coverRes] = await Promise.all([
    getReportsCurrency(),
    safe(api.get<Paged<ContractRow>>(`/contracts?${qs}`)),
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1')),
    // Company-wide counts (the old strip counted only the current page).
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1&signed=yes')),
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1&deliveryDelayed=true')),
    getSession(),
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);
  const covers = new Map((coverRes.data?.data ?? []).map((p) => [p.id, p.media?.[0]?.url]));

  const contracts = contractsRes.data?.data ?? [];
  const meta = contractsRes.data?.meta;
  const totalContracts = allRes.data?.meta.total ?? 0;

  const signedCount = signedRes.data?.meta.total;
  const delayedCount = delayedRes.data?.meta.total;

  // Manual contract creation (contracts:upload) is ADMIN-only; SALES reads.
  const isAdmin = session?.role === 'ADMIN';
  const share = (n: number) => (totalContracts ? Math.round((n / totalContracts) * 100) : 0);
  const ofTotal = locale === 'ar' ? 'من الإجمالي' : 'of total';

  return (
    <ListPage minHeight={960}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {locale === 'ar' ? 'المبيعات / العقود' : 'Sales / Contracts'}
            <span aria-hidden className="h-px w-6 bg-brand-700/40" />
          </span>
        }
        className="shrink-0"
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
      <section className="shrink-0">
        <FigureBar
          variant="cards"
          cols={4}
          figures={[
            { label: m.figures.total, value: totalContracts, href: '/dashboard/contracts', icon: FigIcons.total, sub: locale === 'ar' ? 'كل العقود' : 'All contracts' },
            { label: m.figures.signed, value: signedCount ?? '—', href: '/dashboard/contracts?signed=yes', icon: FigIcons.done, tone: 'green', sub: `${share(signedCount ?? 0)}% ${ofTotal}` },
            {
              label: m.figures.unsigned,
              value: signedCount === undefined ? '—' : totalContracts - signedCount,
              href: '/dashboard/contracts?signed=no',
              icon: FigIcons.sign,
              tone: 'amber',
              warn: signedCount !== undefined && totalContracts - signedCount > 0,
              sub: `${share(signedCount === undefined ? 0 : totalContracts - signedCount)}% ${ofTotal}`,
            },
            { label: m.figures.delayed, value: delayedCount ?? '—', href: '/dashboard/contracts?deliveryDelayed=true', warn: (delayedCount ?? 0) > 0, icon: FigIcons.alert, tone: 'red', sub: `${share(delayedCount ?? 0)}% ${ofTotal}` },
          ]}
        />
      </section>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <ListFilterBar
        action="/dashboard/contracts"
        submitLabel={uiT(locale).common.filterBtn}
        clearHref={sp.q || sp.signed || sp.hasReservation || sp.deliveryDelayed ? '/dashboard/contracts' : undefined}
        clearLabel={uiT(locale).common.clearBtn}
      >
        <ListFilterField search label={m.filter.searchLabel} htmlFor="con-q">
          <Input id="con-q" name="q" inputSize="sm" placeholder={m.filter.searchPlaceholder} defaultValue={sp.q ?? ''} />
        </ListFilterField>
        <ListFilterField label={m.filter.signedLabel} htmlFor="con-signed">
          <Select id="con-signed" name="signed" inputSize="sm" defaultValue={sp.signed ?? ''}>
            <option value="">{m.filter.allSigned}</option>
            <option value="yes">{m.filter.signed}</option>
            <option value="no">{m.filter.unsigned}</option>
          </Select>
        </ListFilterField>
        <ListFilterField label={m.filter.sourceLabel} htmlFor="con-hasReservation">
          <Select id="con-hasReservation" name="hasReservation" inputSize="sm" defaultValue={sp.hasReservation ?? ''}>
            <option value="">{m.filter.allSources}</option>
            <option value="yes">{m.filter.fromReservation}</option>
            <option value="no">{m.filter.manual}</option>
          </Select>
        </ListFilterField>
        <ListFilterField label={m.filter.deliveryLabel} htmlFor="con-delivery">
          <Select id="con-delivery" name="deliveryDelayed" inputSize="sm" defaultValue={sp.deliveryDelayed ?? ''}>
            <option value="">{m.filter.deliveryAll}</option>
            <option value="true">{m.filter.deliveryDelayed}</option>
          </Select>
        </ListFilterField>
      </ListFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {contractsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {contractsRes.error}
        </div>
      )}

      {/* ── Rows ─────────────────────────────────────────────────────────────── */}
      <ListTableCard
        title={locale === 'ar' ? 'قائمة العقود' : 'Contracts list'}
        sub={locale === 'ar' ? 'مرتبة من الأحدث' : 'Newest first'}
        footer={
          meta ? (
            <ListPager page={meta.page} pageSize={meta.pageSize} total={meta.total} basePath="/dashboard/contracts" params={{ q: sp.q, signed: sp.signed, hasReservation: sp.hasReservation, deliveryDelayed: sp.deliveryDelayed }} locale={locale} />
          ) : undefined
        }
        trailing={
          <span className="tabular-nums">
            {(meta?.total ?? contracts.length).toLocaleString(intlLocale(locale))} {m.countSuffix}
          </span>
        }
      >
        {contracts.length === 0 ? (
          <PremiumEmptyState icon={<FileText />} title={m.empty} />
        ) : (
          <DataTable testId="contract-rows">
            <thead>
              <tr>
                <Th>{locale === 'ar' ? 'رقم العقد' : 'Contract'}</Th>
                <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                <Th>{locale === 'ar' ? 'الإجمالي / المقدم' : 'Total / down payment'}</Th>
                <Th>{locale === 'ar' ? 'خطة التقسيط' : 'Installment plan'}</Th>
                <Th>{locale === 'ar' ? 'المصدر' : 'Source'}</Th>
                <Th>{locale === 'ar' ? 'التوقيع' : 'Signature'}</Th>
                <Th>{locale === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const name = c.customer?.fullName ?? '—';
                const href = `/dashboard/contracts/${c.id}`;
                const project = c.unit?.building?.phase?.project;
                return (
                  <Tr key={c.id} testId="contract-row">
                    <Td>
                      <Link href={href as never} data-testid="list-code" className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
                        {c.contractNumber ?? `#${c.id.slice(0, 8).toUpperCase()}`}
                      </Link>
                    </Td>
                    <Td>
                      <PersonCell name={name} phone={c.customer?.phone} href={href} />
                    </Td>
                    <Td>
                      <UnitCell
                        cover={project ? covers.get(project.id) : undefined}
                        project={project ? <EntityLink kind="project" id={project.id} mono={false}>{tx(project.name)}</EntityLink> : undefined}
                        unit={c.unit ? <EntityLink kind="unit" id={c.unit.id}>{c.unit.code}</EntityLink> : undefined}
                        unitWord={m.unitWord}
                      />
                    </Td>
                    <Td className="tabular-nums">
                      <p className="text-[14px] font-bold text-slate-900">{formatCurrency(c.totalAmount, currency, locale)}</p>
                      {Number(c.downPayment) > 0 && (
                        <p className="mt-0.5 text-[12px] text-slate-500">{m.downPaymentPrefix} {formatCurrency(c.downPayment, currency, locale)}</p>
                      )}
                    </Td>
                    <Td>
                      <p className={c.installmentPlan ? 'text-[13px] font-semibold text-slate-800' : 'text-[13px] text-slate-400'}>
                        {c.installmentPlan
                          ? <>{c.installmentPlan.totalMonths} {m.monthsSuffix}</>
                          : m.noPlan}
                      </p>
                      {c.installmentPlan && (
                        <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                          {formatCurrency(c.installmentPlan.monthlyAmount, currency, locale)} {m.perMonth}
                        </p>
                      )}
                    </Td>
                    <Td>
                      {c.reservation ? (
                        <Link href={`/dashboard/reservations/${c.reservation.id}` as never} className="text-[12.5px] hover:text-brand-700">
                          <span className="me-1 text-slate-400">{m.reservationWord}</span>
                          <span className="font-mono" dir="ltr">{c.reservation.reservationNumber ?? c.reservation.id.slice(0, 8)}</span>
                        </Link>
                      ) : (
                        <span className="text-[12.5px] text-slate-500">{m.manualBadge}</span>
                      )}
                    </Td>
                    <Td>
                      {c.signedAt ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                          {m.signedOn} {formatDate(c.signedAt, locale)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-500/12 px-2.5 py-1 text-[12px] font-semibold text-amber-700">{m.unsignedLabel}</span>
                      )}
                    </Td>
                    <Td>
                      <DateText>{formatDate(c.createdAt, locale)}</DateText>
                    </Td>
                    <Td>
                      <Link
                        href={href as never}
                        aria-label={m.viewBtn}
                        title={m.viewBtn}
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
