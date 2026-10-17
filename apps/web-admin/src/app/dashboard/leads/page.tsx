import Link from 'next/link';
import { Plus, AlertCircle, Upload, Users, TrendingUp, UserX, Kanban } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, LeadSource, LeadStage } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { staffOptions } from '@/lib/options';
import { tx } from '@/lib/format';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LeadPipeline } from '@/components/crm/lead-pipeline';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumFilterChips,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Filters {
  stage?: string;
  q?: string;
  unassigned?: string;
  salesId?: string;
  sourceId?: string;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const [sp, locale, session] = await Promise.all([searchParams, getLocale(), getSession()]);
  const m = uiT(locale).pages.leads;
  // Import and routing unowned leads are ADMIN / SALES_MANAGER on the API.
  const canImport = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const canRoute = canImport;
  const unassignedQueue = canRoute && sp.unassigned === '1';

  const qs = new URLSearchParams({ pageSize: '200' });
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.q) qs.set('q', sp.q);
  if (sp.sourceId) qs.set('sourceId', sp.sourceId);
  if (canRoute && sp.salesId) qs.set('salesId', sp.salesId);
  if (unassignedQueue) qs.set('unassigned', '1');

  const [leadsRes, pipelineRes, sourcesRes, repsRes, unassignedRes] = await Promise.all([
    safe(api.get<Paged<Lead>>(`/leads?${qs.toString()}`)),
    safe(api.get<Record<LeadStage, number>>('/leads/pipeline')),
    safe(api.get<LeadSource[]>('/lead-sources')),
    canRoute ? safe(staffOptions(['SALES', 'SALES_MANAGER'], { active: true })) : Promise.resolve({ data: null }),
    canRoute ? safe(api.get<Paged<Lead>>('/leads?unassigned=1&pageSize=1')) : Promise.resolve({ data: null }),
  ]);

  const leads = leadsRes.data?.data ?? [];
  const counts: Partial<Record<LeadStage, number>> = pipelineRes.data ?? {};
  const totalLeads = Object.values(counts).reduce<number>((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  const won = counts.WON ?? 0;
  const open = totalLeads - won - (counts.LOST ?? 0);
  const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;
  const sources = (sourcesRes.data ?? []).filter((s) => s.active);
  const reps = repsRes.data?.data ?? [];

  // The unassigned toggle keeps the other filters.
  const toggleHref = (() => {
    const p = new URLSearchParams();
    for (const k of ['q', 'stage', 'sourceId', 'salesId'] as const) if (sp[k]) p.set(k, sp[k]!);
    if (!unassignedQueue) p.set('unassigned', '1');
    const s = p.toString();
    return `/dashboard/leads${s ? `?${s}` : ''}`;
  })();

  return (
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <>
            {canImport && (
              <Link href={'/dashboard/leads/import' as never}>
                <Button variant="outline" size="md" leftIcon={<Upload className="h-4 w-4" />}>
                  {m.importExcel}
                </Button>
              </Link>
            )}
            <Link href={'/dashboard/leads/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addLead}
              </Button>
            </Link>
          </>
        }
      >
        {/* The band replaces the seven coloured stage pills (U5). */}
        <PremiumMetricStrip
          variant="compact"
          cols={4}
          metrics={[
            { label: m.kpi.total, value: totalLeads, unit: '', icon: <Users /> },
            { label: m.kpi.conversion, value: conversion, unit: '%', icon: <TrendingUp /> },
            ...(canRoute
              ? [{ label: m.kpi.unassigned, value: unassignedRes.data?.meta.total ?? 0, unit: m.kpi.leadUnit, icon: <UserX /> }]
              : []),
            { label: m.kpi.open, value: open, unit: m.kpi.leadUnit, icon: <Kanban /> },
          ]}
        />
      </PremiumPageHero>

      <PremiumFilterBar
        method="get"
        action="/dashboard/leads"
        trailing={
          canRoute ? (
            <PremiumFilterChips
              chips={[{ label: m.unassignedQueue, href: toggleHref, active: unassignedQueue }]}
            />
          ) : undefined
        }
      >
        {unassignedQueue && <input type="hidden" name="unassigned" value="1" />}
        {sp.stage && <input type="hidden" name="stage" value={sp.stage} />}
        <PremiumFilterField label={m.filter.searchLabel} htmlFor="leads-q">
          <Input id="leads-q" name="q" type="search" defaultValue={sp.q ?? ''} placeholder={m.filter.searchPlaceholder} />
        </PremiumFilterField>
        {canRoute && (
          <PremiumFilterField label={m.filter.repLabel} htmlFor="leads-rep">
            <Select id="leads-rep" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
              <option value="">{m.filter.all}</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </Select>
          </PremiumFilterField>
        )}
        <PremiumFilterField label={m.filter.sourceLabel} htmlFor="leads-source">
          <Select id="leads-source" name="sourceId" inputSize="sm" defaultValue={sp.sourceId ?? ''}>
            <option value="">{m.filter.all}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{tx(s.name, locale)}</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {leadsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorPrefix} {leadsRes.error}</p>
        </div>
      )}

      <LeadPipeline leads={leads} counts={counts} locale={locale} />
    </div>
  );
}
