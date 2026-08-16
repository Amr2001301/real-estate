import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Wrench, Plus, AlertCircle, Eye, Settings2, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenanceStatus,
  MaintenanceReviewStatus,
  User,
} from '@/lib/types';
import { formatDate, tx, maintenanceSlaLabel, warrantyMonthsLabel } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/icon-button';
import { MaintenanceStatusBadge, MaintenancePriorityBadge, MaintenanceReviewStatusBadge } from '@/components/badges';
import { ExportMenu } from '@/components/export-menu';
import { MaintenanceReports } from './maintenance-reports';
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
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-info-50 text-info-700',
  HIGH: 'bg-warning-50 text-warning-700',
  URGENT: 'bg-danger-50 text-danger-700',
};

export const dynamic = 'force-dynamic';

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
    catErr?: string;
  }>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).pages.maintenance;

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
  const listQs = new URLSearchParams({ pageSize: '100' });
  if (sp.status) listQs.set('status', sp.status);
  if (sp.assignedAdminId) listQs.set('assignedAdminId', sp.assignedAdminId);
  if (sp.reviewStatus) listQs.set('reviewStatus', sp.reviewStatus);
  if (sp.categoryId) listQs.set('categoryId', sp.categoryId);
  if (sp.from) listQs.set('from', sp.from);
  if (sp.to) listQs.set('to', sp.to);

  const [reqsRes, catsRes, adminsRes] = await Promise.all([
    safe(api.get<Paged<MaintenanceRequest>>(`/maintenance-requests?${listQs}`)),
    safe(api.get<MaintenanceCategory[]>('/maintenance-categories')),
    safe(api.get<Paged<User>>('/users?role=ADMIN&pageSize=100')),
  ]);

  const rows = reqsRes.data?.data ?? [];
  const admins = adminsRes.data?.data ?? [];
  const cats = catsRes.data ?? [];
  const hasFilters = !!(sp.status || sp.assignedAdminId || sp.reviewStatus || sp.categoryId || sp.from || sp.to);
  const reportFilters = {
    status: sp.status,
    reviewStatus: sp.reviewStatus,
    assignedAdminId: sp.assignedAdminId,
    categoryId: sp.categoryId,
    from: sp.from,
    to: sp.to,
  };
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
            <ExportMenu
              xlsxPath="/maintenance-requests/reports/summary.xlsx"
              csvPath="/maintenance-requests/reports/summary.csv"
              filenameBase="maintenance-report"
              params={csvParams}
            />
            <Link href="/dashboard/maintenance/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addBtn}
              </Button>
            </Link>
          </div>
        }
      />

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

      {/* KPI + analytics */}
      <MaintenanceReports filters={reportFilters} locale={locale} />

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
              {reqsRes.data.meta.total.toLocaleString('ar-EG')} {m.requestSuffix}
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
            <table className="w-full text-sm min-w-[1020px]">
              <thead className="bg-canvas/50 border-b border-hairline sticky top-0 backdrop-blur-sm">
                <tr>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.client}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.unit}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.category}</th>
                  <th className="text-start py-3 px-5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.description}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.priority}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.review}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.status}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.targetDate}</th>
                  <th className="text-start py-3 px-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.cols.date}</th>
                  <th className="py-3 px-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row) => {
                  const overdue = isOverdue(row);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'group transition-colors duration-100',
                        overdue ? 'bg-danger-50/30' : 'hover:bg-canvas/40',
                      )}
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-[13px] font-semibold text-slate-900">
                          {row.customer?.fullName ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-[12px] font-semibold text-brand-700">
                          {row.unit?.code ?? <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-[12px] text-slate-600">
                          {row.category ? tx(row.category.name) : <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                      <td
                        className="px-5 py-3.5 text-[12px] text-slate-500 max-w-[200px] truncate"
                        title={row.description}
                      >
                        {row.description}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {row.priority ? (
                          <MaintenancePriorityBadge priority={row.priority} locale={locale} />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <MaintenanceReviewStatusBadge status={row.reviewStatus} locale={locale} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1">
                          <MaintenanceStatusBadge status={row.status} locale={locale} />
                          {row.unresolvedAt ? (
                            <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2 py-0.5 text-[10px] font-semibold">
                              {m.unresolved}
                            </span>
                          ) : row.complaintAt ? (
                            <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2 py-0.5 text-[10px] font-semibold">
                              {m.complaint}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isApproved(row) && row.dueAt ? (
                          <span className={cn(
                            'text-[12px] tabular-nums',
                            overdue ? 'text-danger-600 font-semibold' : 'text-slate-500',
                          )}>
                            {formatDate(row.dueAt)}{overdue ? m.overdue : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
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

      {/* Category management */}
      <PremiumSectionCard
        title={m.categories.sectionTitle}
        icon={<Settings2 />}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">{cats.length} {m.categories.categorySuffix}</span>
        }
        padded={false}
      >
        {cats.length > 0 && (
          <div className="px-5 pt-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cats.map((c) => {
              const sla = maintenanceSlaLabel(c.slaDurationMinutes);
              const warranty = warrantyMonthsLabel(c.warrantyDurationMonths);
              return (
                <div
                  key={c.id}
                  className="group flex overflow-hidden rounded-xl border border-hairline bg-surface shadow-soft hover:shadow-md transition-all duration-150"
                >
                  <div className={cn('w-1.5 shrink-0 rounded-s-xl', PRIORITY_DOT[c.priority] ?? 'bg-slate-400')} />
                  <div className="flex-1 px-4 py-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-bold text-slate-900 leading-tight">{tx(c.name)}</p>
                        {c.name.en && (
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{c.name.en}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0',
                          PRIORITY_BADGE[c.priority] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {PRIORITY_LABEL[c.priority] ?? c.priority}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {sla && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="text-[12px] text-slate-500">{m.categories.slaPrefix} {sla}</span>
                        </div>
                      )}
                      {warranty && (
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="text-[12px] text-slate-500">{m.categories.warrantyPrefix} {warranty}</span>
                        </div>
                      )}
                      {!sla && !warranty && (
                        <p className="text-[11px] text-slate-400">{m.categories.noSla}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add category form */}
        <div className="border-t border-hairline bg-canvas/30 px-5 py-4">
          {sp.catErr && (
            <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-3 py-2 text-xs mb-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{m.categoryErrorPrefix} {sp.catErr}</p>
            </div>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-3">
            {m.categories.addTitle}
          </p>
          <form action={createCategoryAction}>
            <div className="flex flex-wrap items-center gap-2">
              <Input name="ar" required dir="rtl" placeholder={m.categories.namePlaceholderAr} inputSize="sm" className="w-32" />
              <Input name="en" required dir="ltr" placeholder={m.categories.namePlaceholderEn} inputSize="sm" className="w-32" />
              <Select name="priority" inputSize="sm" defaultValue="MEDIUM" className="w-28" aria-label={m.categories.priorityAriaLabel}>
                <option value="LOW">{m.priorityLabels.LOW}</option>
                <option value="MEDIUM">{m.priorityLabels.MEDIUM}</option>
                <option value="HIGH">{m.priorityLabels.HIGH}</option>
                <option value="URGENT">{m.priorityLabels.URGENT}</option>
              </Select>
              <span className="w-px h-5 bg-hairline shrink-0" aria-hidden />
              <Input name="slaValue" type="number" min={1} placeholder={m.categories.slaPlaceholder} inputSize="sm" className="w-28" />
              <Select name="slaUnit" inputSize="sm" defaultValue="HOURS" className="w-20" aria-label={m.categories.slaAriaLabel}>
                <option value="HOURS">{m.categories.slaHours}</option>
                <option value="DAYS">{m.categories.slaDays}</option>
              </Select>
              <Input name="warrantyValue" type="number" min={1} placeholder={m.categories.warrantyPlaceholder} inputSize="sm" className="w-28" />
              <Select name="warrantyUnit" inputSize="sm" defaultValue="MONTHS" className="w-20" aria-label={m.categories.warrantyAriaLabel}>
                <option value="MONTHS">{m.categories.warrantyMonths}</option>
                <option value="YEARS">{m.categories.warrantyYears}</option>
              </Select>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                {m.categories.addBtn}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5">
              {m.categories.helper}
            </p>
          </form>
        </div>
      </PremiumSectionCard>
    </div>
  );
}
