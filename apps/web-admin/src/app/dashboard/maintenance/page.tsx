import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  Wrench, Plus, AlertCircle, Eye, Settings2, Clock, Shield,
  Zap, Droplets, AirVent, Hammer, Paintbrush, KeyRound, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import { getSession } from '@/lib/session';
import { getMyCodes } from '@/lib/permissions';
import type {
  Paged,
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenanceStatus,
  MaintenanceReviewStatus,
} from '@/lib/types';
import { formatDate, tx, maintenanceSlaLabel, warrantyMonthsLabel, intlLocale } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/icon-button';
import { Pagination } from '@/components/ui/pagination';
import { MaintenanceStatusBadge, MaintenanceReviewStatusBadge } from '@/components/badges';
import { PersonCell } from '@/components/premium/list-cells';
import { ExportMenu } from '@/components/export-menu';
import { MaintenanceReports, loadMaintenanceSummary } from './maintenance-reports';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

// dueAt/overdue only apply once a request is approved (the SLA timer starts then).
function isApproved(r: MaintenanceRequest): boolean {
  return r.reviewStatus === 'APPROVED';
}
function isOverdue(r: MaintenanceRequest): boolean {
  return isApproved(r) && !!r.dueAt && r.status !== 'CLOSED' && new Date(r.dueAt).getTime() < Date.now();
}

// PRIORITY_LABEL built from messages in page body

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-info-400',
  HIGH: 'bg-warning-500',
  URGENT: 'bg-danger-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-500/10 text-slate-500',
  MEDIUM: 'bg-sky-500/12 text-sky-600',
  HIGH: 'bg-amber-500/12 text-amber-600',
  URGENT: 'bg-danger-500/12 text-danger-600',
};

// A category's icon from its English name; anything unmatched is a wrench.
const CATEGORY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/electr/i, Zap],
  [/plumb|water|leak/i, Droplets],
  [/hvac|air|ac\b|cool/i, AirVent],
  [/paint|finish/i, Paintbrush],
  [/door|lock|key/i, KeyRound],
  [/general|carpent/i, Hammer],
];
function categoryIcon(en?: string | null): LucideIcon {
  return CATEGORY_ICONS.find(([re]) => re.test(en ?? ''))?.[1] ?? Wrench;
}

export const dynamic = 'force-dynamic';

const fieldLabel = 'flex flex-col gap-1.5 text-[12px] font-semibold text-slate-500';

const REVIEW_STATUSES: MaintenanceReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const STATUSES: MaintenanceStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

async function createCategoryAction(formData: FormData) {
  'use server';
  const slaRaw = String(formData.get('slaValue') ?? '').trim();
  const slaValue = slaRaw ? Number(slaRaw) : undefined;
  const warrantyRaw = String(formData.get('warrantyValue') ?? '').trim();
  const warrantyValue = warrantyRaw ? Number(warrantyRaw) : undefined;
  const res = await safe(
    api.post('/maintenance-categories', {
      ar: String(formData.get('ar') ?? ''),
      en: String(formData.get('en') ?? ''),
      priority: String(formData.get('priority') ?? 'MEDIUM'),
      ...(slaValue ? { slaValue, slaUnit: String(formData.get('slaUnit') ?? 'HOURS') } : {}),
      ...(warrantyValue
        ? { warrantyValue, warrantyUnit: String(formData.get('warrantyUnit') ?? 'MONTHS') }
        : {}),
    }),
  );
  if (res.error) {
    redirect(`/dashboard/maintenance?catErr=${encodeURIComponent(res.error)}`);
  }
  revalidatePath('/dashboard/maintenance');
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    assignedAdminId?: string;
    reviewStatus?: string;
    categoryId?: string;
    from?: string;
    to?: string;
    page?: string;
    catErr?: string;
  }>;
}) {
  const [locale, session, codes] = await Promise.all([getLocale(), getSession(), getMyCodes()]);
  const m = uiT(locale).pages.maintenance;
  const isAdmin = session?.role === 'ADMIN';
  const canCategories = codes.has('maintenance:categories:manage');

  const STATUS_LABEL: Record<MaintenanceStatus, string> = {
    OPEN:        m.statusLabels.OPEN,
    ASSIGNED:    m.statusLabels.ASSIGNED,
    IN_PROGRESS: m.statusLabels.IN_PROGRESS,
    RESOLVED:    m.statusLabels.RESOLVED,
    CLOSED:      m.statusLabels.CLOSED,
  };

  const REVIEW_LABEL: Record<MaintenanceReviewStatus, string> = {
    PENDING:  m.reviewLabels.PENDING,
    APPROVED: m.reviewLabels.APPROVED,
    REJECTED: m.reviewLabels.REJECTED,
  };

  const PRIORITY_LABEL: Record<string, string> = {
    LOW:    m.priorityLabels.LOW,
    MEDIUM: m.priorityLabels.MEDIUM,
    HIGH:   m.priorityLabels.HIGH,
    URGENT: m.priorityLabels.URGENT,
  };

  const sp = await searchParams;
  // FG-23 — paged: the list used to be one `pageSize=100` fetch with no pager,
  // so request 101 was never shown.
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 20;
  const listQs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.status) listQs.set('status', sp.status);
  if (sp.assignedAdminId) listQs.set('assignedAdminId', sp.assignedAdminId);
  if (sp.reviewStatus) listQs.set('reviewStatus', sp.reviewStatus);
  if (sp.categoryId) listQs.set('categoryId', sp.categoryId);
  if (sp.from) listQs.set('from', sp.from);
  if (sp.to) listQs.set('to', sp.to);

  const reportFilters = {
    status: sp.status,
    reviewStatus: sp.reviewStatus,
    assignedAdminId: sp.assignedAdminId,
    categoryId: sp.categoryId,
    from: sp.from,
    to: sp.to,
  };
  const [reqsRes, catsRes, adminsRes, summaryRes] = await Promise.all([
    safe(api.get<Paged<MaintenanceRequest>>(`/maintenance-requests?${listQs}`)),
    safe(api.get<MaintenanceCategory[]>('/maintenance-categories')),
    // Requests are assigned to admins and maintenance supervisors (F36).
    safe(staffOptions(['ADMIN', 'MAINTENANCE_SUPERVISOR'])),
    loadMaintenanceSummary(reportFilters),
  ]);

  const rows = reqsRes.data?.data ?? [];
  const admins = adminsRes.data?.data ?? [];
  const cats = catsRes.data ?? [];
  const hasFilters = !!(sp.status || sp.assignedAdminId || sp.reviewStatus || sp.categoryId || sp.from || sp.to);
  const csvParams: Record<string, string | undefined> = {
    status: sp.status,
    reviewStatus: sp.reviewStatus,
    assignedAdminId: sp.assignedAdminId,
    categoryId: sp.categoryId,
    from: sp.from,
    to: sp.to,
  };

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu locale={locale}
              pdfPath="/maintenance-requests/reports/summary.pdf"
              xlsxPath="/maintenance-requests/reports/summary.xlsx"
              csvPath="/maintenance-requests/reports/summary.csv"
              filenameBase="maintenance-report"
              params={csvParams}
            />
            {/* PRM2 — a request on a customer's behalf needs the customer list: admin only. */}
            {isAdmin && (
              <Link href="/dashboard/maintenance/new">
                <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                  {m.addBtn}
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* KPIs first, like every list page; the analytics panels sit under the table */}
      <MaintenanceReports res={summaryRes} part="kpis" locale={locale} />

      <PremiumFilterBar
        method="get"
        action="/dashboard/maintenance"
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
            {hasFilters && (
              <Link href="/dashboard/maintenance">
                <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={m.filter.statusLabel} htmlFor="maint-status">
          <Select
            id="maint-status"
            name="status"
            inputSize="sm"
            defaultValue={sp.status ?? ''}
            className="w-36"
          >
            <option value="">{uiT(locale).common.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.reviewLabel} htmlFor="maint-review">
          <Select
            id="maint-review"
            name="reviewStatus"
            inputSize="sm"
            defaultValue={sp.reviewStatus ?? ''}
            className="w-36"
          >
            <option value="">{m.filter.allReviews}</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{REVIEW_LABEL[s]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.categoryLabel} htmlFor="maint-category">
          <Select
            id="maint-category"
            name="categoryId"
            inputSize="sm"
            defaultValue={sp.categoryId ?? ''}
            className="w-44"
          >
            <option value="">{m.filter.allCategories}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{tx(c.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.supervisorLabel} htmlFor="maint-admin">
          <Select
            id="maint-admin"
            name="assignedAdminId"
            inputSize="sm"
            defaultValue={sp.assignedAdminId ?? ''}
            className="w-36"
          >
            <option value="">{m.filter.allSupervisors}</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.fullName}</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {reqsRes.error && (
        <div className="flex items-start gap-2 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{m.errorPrefix} {reqsRes.error}</p>
        </div>
      )}

      {/* Requests table */}
      <PremiumSectionCard
        title={m.sectionTitle}
        trailing={
          reqsRes.data ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {reqsRes.data.meta.total.toLocaleString(intlLocale(locale))} {m.requestSuffix}
            </span>
          ) : undefined
        }
        padded={false}
      >
        {rows.length === 0 ? (
          <PremiumEmptyState
            icon={<Wrench />}
            title={m.empty.title}
            description={
              hasFilters
                ? m.empty.filteredDesc
                : m.empty.emptyDesc
            }
            action={
              hasFilters ? (
                <Link href="/dashboard/maintenance">
                  <Button variant="outline" size="sm">{m.empty.clearBtn}</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]" data-testid="maintenance-table">
              <thead className="bg-surface-muted/50 border-b border-hairline">
                <tr>
                  <th className="text-start py-3 px-4 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 ps-5">{m.cols.client}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{m.cols.category}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{m.cols.priority}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{m.cols.status}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{m.cols.targetDate}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{m.cols.date}</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row) => {
                  const overdue = isOverdue(row);
                  const Icon = categoryIcon(row.category?.name.en);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'group transition-colors duration-100',
                        overdue ? 'bg-danger-500/[0.06]' : 'hover:bg-brand-500/[0.04]',
                      )}
                    >
                      <td className="ps-5 pe-4 py-3.5">
                        {/* The unit rides under the client: one column instead of two */}
                        <PersonCell
                          name={row.customer?.fullName ?? '—'}
                          nameLink={row.customer ? { kind: 'customer', id: row.customer.id } : undefined}
                          sub={row.unit?.code}
                          subLabel={uiT(locale).common.codeKind.unit}
                          subLink={{ kind: 'unit', id: row.unit?.id ?? row.unitId }}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="min-w-[200px] max-w-[320px]">
                          {row.category && (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              {tx(row.category.name)}
                            </span>
                          )}
                          <p className="mt-0.5 truncate text-[12px] text-slate-500" title={row.description}>{row.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {row.priority ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                            <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[row.priority] ?? 'bg-slate-400')} />
                            {PRIORITY_LABEL[row.priority] ?? row.priority}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Review shows only while it matters: pending or rejected */}
                          {row.reviewStatus !== 'APPROVED' ? (
                            <MaintenanceReviewStatusBadge status={row.reviewStatus} locale={locale} />
                          ) : (
                            <MaintenanceStatusBadge status={row.status} locale={locale} />
                          )}
                          {row.unresolvedAt ? (
                            <span className="inline-flex items-center rounded-full bg-danger-500/12 text-danger-600 px-2 py-0.5 text-[10.5px] font-semibold">
                              {m.unresolved}
                            </span>
                          ) : row.complaintAt ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/12 text-amber-600 px-2 py-0.5 text-[10.5px] font-semibold">
                              {m.complaint}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isApproved(row) && row.dueAt ? (
                          <span className={cn(
                            'text-[12.5px] tabular-nums',
                            overdue ? 'text-danger-600 font-bold' : 'text-slate-700',
                          )}>
                            {formatDate(row.dueAt, locale)}{overdue ? m.overdue : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[12.5px] text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDate(row.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-end">
                        <Link href={`/dashboard/maintenance/${row.id}`}>
                          <IconButton label={m.viewBtn} variant="outline" size="sm">
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
        )}
      </PremiumSectionCard>

      {reqsRes.data && reqsRes.data.meta.total > pageSize && (
        <Pagination
          basePath="/dashboard/maintenance"
          page={page}
          pageSize={pageSize}
          total={reqsRes.data.meta.total}
          params={csvParams}
          locale={locale}
        />
      )}

      <MaintenanceReports res={summaryRes} part="panels" locale={locale} />

      {/* Category management */}
      {canCategories && (
      <PremiumSectionCard
        title={m.categories.sectionTitle}
        icon={<Settings2 />}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">{cats.length} {m.categories.categorySuffix}</span>
        }
        padded={false}
      >
        {cats.length > 0 && (
          <div className="px-5 pt-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cats.map((c) => {
              const sla = maintenanceSlaLabel(c.slaDurationMinutes, locale);
              const warranty = warrantyMonthsLabel(c.warrantyDurationMonths, locale);
              const CatIcon = categoryIcon(c.name.en);
              return (
                <div
                  key={c.id}
                  data-testid="maintenance-category"
                  className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface px-4 py-4 transition-colors hover:border-brand-500/40"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-700/15 text-brand-700 ring-1 ring-brand-500/30">
                    <CatIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-bold text-slate-900">{tx(c.name)}</p>
                        {c.name.en && <p className="truncate text-[11.5px] text-slate-500" dir="ltr">{c.name.en}</p>}
                      </div>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          PRIORITY_BADGE[c.priority] ?? 'bg-slate-500/10 text-slate-500',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[c.priority] ?? 'bg-slate-400')} />
                        {PRIORITY_LABEL[c.priority] ?? c.priority}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sla && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] text-slate-600">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {m.categories.slaPrefix} {sla}
                        </span>
                      )}
                      {warranty && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] text-slate-600">
                          <Shield className="h-3 w-3 text-slate-400" />
                          {m.categories.warrantyPrefix} {warranty}
                        </span>
                      )}
                      {!sla && !warranty && (
                        <span className="text-[11.5px] text-slate-400">{m.categories.noSla}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add category form */}
        <div className="border-t border-hairline bg-surface-muted/30 px-5 py-5">
          {sp.catErr && (
            <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-3 py-2 text-xs mb-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{m.categoryErrorPrefix} {sp.catErr}</p>
            </div>
          )}
          <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-800">
            <Plus className="h-4 w-4 text-brand-700" />
            {m.categories.addTitle}
          </p>
          <form action={createCategoryAction} data-testid="maintenance-category-form">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_0.8fr_1.1fr_1.1fr_auto] xl:items-end">
              <label className={fieldLabel}>
                {m.categories.namePlaceholderAr}
                <Input name="ar" required dir="rtl" inputSize="sm" />
              </label>
              <label className={fieldLabel}>
                {m.categories.namePlaceholderEn}
                <Input name="en" required dir="ltr" inputSize="sm" />
              </label>
              <label className={fieldLabel}>
                {m.categories.priorityAriaLabel}
                <Select name="priority" inputSize="sm" defaultValue="MEDIUM">
                  <option value="LOW">{m.priorityLabels.LOW}</option>
                  <option value="MEDIUM">{m.priorityLabels.MEDIUM}</option>
                  <option value="HIGH">{m.priorityLabels.HIGH}</option>
                  <option value="URGENT">{m.priorityLabels.URGENT}</option>
                </Select>
              </label>
              <div className={fieldLabel}>
                <span>{m.categories.slaPlaceholder}</span>
                <div className="flex gap-1.5">
                  <Input name="slaValue" type="number" min={1} inputSize="sm" aria-label={m.categories.slaPlaceholder} className="min-w-0 flex-1" />
                  <Select name="slaUnit" inputSize="sm" defaultValue="HOURS" className="w-24" aria-label={m.categories.slaAriaLabel}>
                    <option value="HOURS">{m.categories.slaHours}</option>
                    <option value="DAYS">{m.categories.slaDays}</option>
                  </Select>
                </div>
              </div>
              <div className={fieldLabel}>
                <span>{m.categories.warrantyPlaceholder}</span>
                <div className="flex gap-1.5">
                  <Input name="warrantyValue" type="number" min={1} inputSize="sm" aria-label={m.categories.warrantyPlaceholder} className="min-w-0 flex-1" />
                  <Select name="warrantyUnit" inputSize="sm" defaultValue="MONTHS" className="w-24" aria-label={m.categories.warrantyAriaLabel}>
                    <option value="MONTHS">{m.categories.warrantyMonths}</option>
                    <option value="YEARS">{m.categories.warrantyYears}</option>
                  </Select>
                </div>
              </div>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} className="h-10">
                {m.categories.addBtn}
              </Button>
            </div>
            <p className="text-[11.5px] text-slate-500 mt-3">
              {m.categories.helper}
            </p>
          </form>
        </div>
      </PremiumSectionCard>
      )}
    </div>
  );
}
