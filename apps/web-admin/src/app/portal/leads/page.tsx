import Link from 'next/link';
import {
  Plus,
  Users,
  Mail,
  Phone,
  Eye,
  UserCheck,
  UserX,
  Clock,
  Copy,
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
import { IconButton } from '@/components/ui/icon-button';
import { CodeText } from '@/components/ui/code-text';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerLeadStatusBadge, LeadStageBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
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

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

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

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: t.metrics.total, value: totalLeads,    icon: <Users />,     tone: 'brand'   },
          { label: t.metrics.pending, value: pendingCount,  icon: <Clock />,     tone: 'warning' },
          { label: t.metrics.approved,  value: approvedCount, icon: <UserCheck />, tone: 'success' },
          { label: t.metrics.rejected, value: rejectedCount, icon: <UserX />,     tone: 'danger'  },
        ]}
      />

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

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">{t.cols.client}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.projectInterest}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.stage}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.approvalStatus}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.date}</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<Users />}
                      title={t.emptyTitle}
                      description={t.emptyDescription}
                      action={
                        <Link href="/portal/leads/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            {t.newLead}
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((l) => {
                const isDuplicate = l.brokerApprovalStatus === 'DUPLICATE';
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      'border-t border-hairline align-top transition-colors hover:bg-surface-muted/40',
                      isDuplicate && 'opacity-60',
                    )}
                  >
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(l.fullName)}`}
                        >
                          {isDuplicate ? <Copy className="h-3.5 w-3.5" /> : initials(l.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-xs">{l.fullName}</p>
                          <a
                            href={`tel:${l.phone}`}
                            className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                            dir="ltr"
                          >
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            {l.phone}
                          </a>
                          {l.email && (
                            <a
                              href={`mailto:${l.email}`}
                              className="text-2xs text-slate-400 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                              dir="ltr"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[140px]">{l.email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {l.projectInterest ? (
                        <>
                          <p className="text-xs font-semibold text-slate-800 truncate max-w-[160px]">
                            {tx(l.projectInterest.name, locale)}
                          </p>
                          {l.unitInterest ? (
                            <p className="mt-0.5">
                              <CodeText className="text-2xs text-slate-500">{l.unitInterest.code}</CodeText>
                            </p>
                          ) : (
                            <p className="text-2xs text-slate-400 mt-0.5">{t.anyUnit}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">{t.notSpecified}</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <LeadStageBadge stage={l.stage} locale={locale} />
                    </td>

                    <td className="py-3 px-4">
                      {l.brokerApprovalStatus ? (
                        <BrokerLeadStatusBadge status={l.brokerApprovalStatus} locale={locale} />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                      {formatDate(l.brokerSubmittedAt ?? l.createdAt, locale)}
                    </td>

                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/portal/leads/${l.id}` as never}>
                        <IconButton label={t.view} variant="ghost" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
