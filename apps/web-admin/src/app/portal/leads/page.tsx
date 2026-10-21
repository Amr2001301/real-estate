import Link from 'next/link';
import {
  Plus,
  Users,
  Mail,
  Phone,
  Eye,
  Copy,
  Building2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalLead } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { portalLeadsVisitsT } from '@/messages/portal/leads-visits';
import { Button } from '@/components/ui/button';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerLeadStatusBadge, LeadStageBadge } from '@/components/badges';
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
  brokerApprovalStatus?: string;
  stage?: string;
  q?: string;
}

const PAGE_SIZE = 20;

export default async function PortalLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalLeadsVisitsT(locale);
  const t = m.leads.list;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.brokerApprovalStatus) qs.set('brokerApprovalStatus', sp.brokerApprovalStatus);
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.q) qs.set('q', sp.q);

  const [r, rAll, rPending, rApproved, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalLead>>(`/portal/leads?${qs.toString()}`)),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1&brokerApprovalStatus=PENDING')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1&brokerApprovalStatus=APPROVED')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1&brokerApprovalStatus=REJECTED')),
  ]);

  const paged          = r.data;
  const rows           = paged?.data ?? [];
  const totalLeads     = rAll.data?.meta.total     ?? 0;
  const pendingCount   = rPending.data?.meta.total  ?? 0;
  const approvedCount  = rApproved.data?.meta.total ?? 0;
  const rejectedCount  = rRejected.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.breadcrumbs.portal, href: '/portal' },
          { label: m.breadcrumbs.leads },
        ]}
        actions={
          <Link href="/portal/leads/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {t.newLead}
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadErrorPrefix} {r.error}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: totalLeads, href: '/portal/leads' },
            { label: t.metrics.pending, value: pendingCount, href: '/portal/leads?brokerApprovalStatus=PENDING', warn: pendingCount > 0 },
            { label: t.metrics.approved, value: approvedCount, href: '/portal/leads?brokerApprovalStatus=APPROVED' },
            { label: t.metrics.rejected, value: rejectedCount, href: '/portal/leads?brokerApprovalStatus=REJECTED' },
          ]}
        />
      </section>

      <PremiumFilterBar
        method="get"
        action="/portal/leads"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">{t.filter}</Button>
            {(sp.q || sp.brokerApprovalStatus || sp.stage) && (
              <Link href="/portal/leads">
                <Button type="button" variant="ghost" size="sm">{t.clearFilter}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={t.searchLabel}>
          <Input
            name="q"
            inputSize="sm"
            leftAddon={<Search />}
            placeholder={t.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="flex-1 min-w-[160px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label={t.approvalStatusLabel}>
          <Select
            name="brokerApprovalStatus"
            inputSize="sm"
            defaultValue={sp.brokerApprovalStatus ?? ''}
            className="w-44"
          >
            <option value="">{t.approvalStatusOptions.all}</option>
            <option value="PENDING">{t.approvalStatusOptions.PENDING}</option>
            <option value="APPROVED">{t.approvalStatusOptions.APPROVED}</option>
            <option value="REJECTED">{t.approvalStatusOptions.REJECTED}</option>
            <option value="DUPLICATE">{t.approvalStatusOptions.DUPLICATE}</option>
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={t.stageLabel}>
          <Select
            name="stage"
            inputSize="sm"
            defaultValue={sp.stage ?? ''}
            className="w-40"
          >
            <option value="">{t.stageOptions.all}</option>
            <option value="NEW">{t.stageOptions.NEW}</option>
            <option value="INTERESTED">{t.stageOptions.INTERESTED}</option>
            <option value="VISIT">{t.stageOptions.VISIT}</option>
            <option value="NEGOTIATION">{t.stageOptions.NEGOTIATION}</option>
            <option value="WON">{t.stageOptions.WON}</option>
            <option value="LOST">{t.stageOptions.LOST}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        icon={<Users />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>{t.countNoun}</span>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Link href="/portal/leads/new">
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  {t.newLead}
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-lead-rows">
            {rows.map((l) => {
              const isDuplicate = l.brokerApprovalStatus === 'DUPLICATE';
              const href = `/portal/leads/${l.id}`;
              return (
                <li
                  key={l.id}
                  data-testid="portal-lead-row"
                  className={cn(
                    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_130px_36px]',
                    isDuplicate && 'opacity-60',
                  )}
                >
                  {isDuplicate ? (
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-500/12 text-slate-500">
                      <Copy className="h-4 w-4" />
                    </span>
                  ) : (
                    <Avatar name={l.fullName} />
                  )}

                  {/* Client */}
                  <div className="min-w-0">
                    <Link href={href as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {l.fullName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                      <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 tabular-nums hover:text-brand-700">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span dir="ltr">{l.phone}</span>
                      </a>
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-brand-700">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="max-w-[180px] truncate" dir="ltr">{l.email}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Project + unit */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className={cn('truncate font-semibold', l.projectInterest ? 'text-slate-800' : 'text-slate-400')}>
                        {l.projectInterest ? tx(l.projectInterest.name, locale) : t.notSpecified}
                      </p>
                      {l.projectInterest && (
                        <p className="mt-0.5 text-slate-500">
                          {l.unitInterest ? (
                            <>
                              <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span>
                              <span className="whitespace-nowrap font-mono" dir="ltr">{l.unitInterest.code}</span>
                            </>
                          ) : (
                            t.anyUnit
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Review + stage */}
                  <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
                    {l.brokerApprovalStatus && <BrokerLeadStatusBadge status={l.brokerApprovalStatus} locale={locale} />}
                    <LeadStageBadge stage={l.stage} locale={locale} />
                  </div>

                  {/* Submitted */}
                  <span className="hidden whitespace-nowrap text-[12px] tabular-nums text-slate-500 lg:block">
                    <bdi>{formatDate(l.brokerSubmittedAt ?? l.createdAt, locale)}</bdi>
                  </span>

                  <Link
                    href={href as never}
                    aria-label={t.view}
                    title={t.view}
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
            basePath="/portal/leads"
            locale={locale}
            params={{
              q: sp.q,
              brokerApprovalStatus: sp.brokerApprovalStatus,
              stage: sp.stage,
            }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
