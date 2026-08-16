import Link from 'next/link';
import { Plus, Wallet, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, InstallmentPlanTemplate } from '@/lib/types';
import { formatDate, formatCurrency, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { PlanTemplateStatusBadge } from '@/components/badges';
import { PlanActions } from './_components/plan-actions';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

interface Stats {
  total: number;
  active: number;
  draft: number;
  inactive: number;
}

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

// FREQUENCY_LABELS built from messages in page body

export default async function InstallmentPlansPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    projectId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const [sp, session, locale] = await Promise.all([searchParams, getSession(), getLocale()]);
  const m = uiT(locale).pages.installments;
  const FREQUENCY_LABELS: Record<string, string> = {
    MONTHLY:     m.frequencyLabels.MONTHLY,
    QUARTERLY:   m.frequencyLabels.QUARTERLY,
    SEMI_ANNUAL: m.frequencyLabels.BIANNUAL,
    BIANNUAL:    m.frequencyLabels.BIANNUAL,
    YEARLY:      m.frequencyLabels.ANNUAL,
    ANNUAL:      m.frequencyLabels.ANNUAL,
  };
  const currency = await getReportsCurrency();
  const isAdmin = session?.role === 'ADMIN';
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.status) qs.set('status', sp.status);

  const [statsRes, plansRes, projectsRes] = await Promise.all([
    isAdmin
      ? safe(api.get<Stats>('/installment-plan-templates/stats'))
      : Promise.resolve({ data: null, error: null }),
    safe(api.get<Paged<InstallmentPlanTemplate>>(`/installment-plan-templates?${qs}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
  ]);

  const stats = statsRes.data;
  const plans = plansRes.data?.data ?? [];
  const paginationMeta = plansRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];

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
          isAdmin ? (
            <Link href="/dashboard/installments/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addBtn}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {isAdmin && stats && (
        <PremiumMetricStrip
          variant="compact"
          metrics={[
            {
              label: m.kpi.total,
              value: stats.total,
              icon: <Wallet className="h-4 w-4" />,
              primary: true,
              tone: 'brand',
            },
            {
              label: m.kpi.active,
              value: stats.active,
              icon: <CheckCircle2 className="h-4 w-4" />,
              tone: 'success',
            },
            {
              label: m.kpi.draft,
              value: stats.draft,
              icon: <FileText className="h-4 w-4" />,
              tone: 'warning',
            },
            {
              label: m.kpi.inactive,
              value: stats.inactive,
              icon: <Wallet className="h-4 w-4" />,
              tone: 'neutral',
            },
          ]}
        />
      )}

      <PremiumFilterBar
        method="get"
        action="/dashboard/installments"
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
            {(sp.q || sp.projectId || sp.status) && (
              <Link href="/dashboard/installments">
                <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={m.filter.searchLabel}>
          <Input
            name="q"
            inputSize="sm"
            defaultValue={sp.q ?? ''}
            placeholder={m.filter.searchPlaceholder}
            className="min-w-[180px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label={uiT(locale).common.allProjects}>
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40">
            <option value="">{uiT(locale).common.allProjects}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>
        {isAdmin && (
          <PremiumFilterField label={m.filter.statusLabel}>
            <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36">
              <option value="">{m.filter.allStatuses}</option>
              <option value="DRAFT">{m.filter.draft}</option>
              <option value="ACTIVE">{m.filter.active}</option>
              <option value="INACTIVE">{m.filter.inactive}</option>
            </Select>
          </PremiumFilterField>
        )}
      </PremiumFilterBar>

      {plansRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{plansRes.error}</p>
        </div>
      )}

      <PremiumSectionCard
        title={m.sectionTitle}
        trailing={
          paginationMeta ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {paginationMeta.total.toLocaleString('ar-EG')} {m.planSuffix}
            </span>
          ) : undefined
        }
        padded={false}
      >
        {plans.length === 0 ? (
          <PremiumEmptyState
            icon={<Wallet />}
            title={m.empty.title}
            description={m.empty.description}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4">{m.cols.name}</th>
                  <th className="text-start py-3 px-4">{m.cols.project}</th>
                  <th className="text-start py-3 px-4">{m.cols.netPrice}</th>
                  <th className="text-start py-3 px-4">{m.cols.installments}</th>
                  <th className="text-start py-3 px-4">{m.cols.status}</th>
                  <th className="text-start py-3 px-4">{m.cols.created}</th>
                  <th className="py-3 ps-4 pe-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {plans.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/40 transition-colors duration-100 align-middle">
                    <td className="py-3 ps-5 pe-4">
                      <Link
                        href={`/dashboard/installments/${r.id}`}
                        className="font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-slate-800">{r.project ? tx(r.project.name) : '—'}</p>
                        {r.unit && <p className="text-xs text-slate-500">{m.unitPrefix} {r.unit.code}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums font-medium text-slate-800">
                      {formatCurrency(r.netPrice, currency)}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const optionsCount = r.durationOptions?.length ?? 0;
                        if (optionsCount > 0) {
                          return (
                            <div>
                              <p className="text-slate-800">{m.durationOptions(optionsCount)}</p>
                              <p className="text-xs text-slate-500">
                                {r.durationOptions!.map((o) => `${o.durationMonths}${m.durationSuffix}`).join(' / ')}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <p className="text-slate-800">
                              {r.installmentsCount != null ? `${r.installmentsCount} ${m.installmentSuffix}` : '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                            </p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <PlanTemplateStatusBadge status={r.status} locale={locale} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="py-3 ps-4 pe-5 text-end">
                      <PlanActions plan={r} isAdmin={isAdmin} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {paginationMeta && paginationMeta.totalPages > 1 && (
        <Pagination
          page={paginationMeta.page}
          pageSize={paginationMeta.pageSize}
          total={paginationMeta.total}
          basePath="/dashboard/installments"
          params={sp}
          locale={locale}
        />
      )}
    </div>
  );
}
