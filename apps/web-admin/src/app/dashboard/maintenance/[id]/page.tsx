import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  Wrench, User as UserIcon, Home, AlertCircle, UserCog, ArrowLeft,
  CheckCircle2, XCircle, ClipboardList, Star, ShieldCheck, Phone, Mail,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type {
  MaintenancePriority, MaintenanceResolutionConfirmedBy, MaintenanceReviewStatus,
  MaintenanceStatus, MaintenanceRequestItem, Paged, User,
} from '@/lib/types';
import { formatDateTime, tx, maintenanceSlaLabel, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  MaintenanceStatusBadge, MaintenancePriorityBadge,
  MaintenanceReviewStatusBadge, WarrantyStatusBadge,
} from '@/components/badges';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

interface MaintenanceDetail {
  id: string;
  description: string;
  status: MaintenanceStatus;
  reviewStatus: MaintenanceReviewStatus;
  priority: MaintenancePriority | null;
  dueAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  maxHandlingSlaMinutesSnapshot: number | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; phone: string | null; email: string | null };
  unit?: { id: string; code: string; type: string; floor: number };
  category?: { id: string; name: { ar: string; en: string } };
  assignedAdmin?: { id: string; fullName: string } | null;
  assignedAdminId: string | null;
  items?: MaintenanceRequestItem[];
  complaintAt?: string | null;
  unresolvedAt?: string | null;
  customerConfirmedResolutionAt?: string | null;
  supervisorConfirmedResolutionAt?: string | null;
  resolvedBy?: MaintenanceResolutionConfirmedBy | null;
  customerRating?: number | null;
  customerRatingText?: string | null;
  customerRatingSubmittedAt?: string | null;
}

const NEXT_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};
const ACTION_VARIANT: Record<MaintenanceStatus, 'primary' | 'outline'> = {
  RESOLVED: 'primary',
  CLOSED: 'primary',
  ASSIGNED: 'outline',
  IN_PROGRESS: 'primary',
  OPEN: 'outline',
};

function back(id: string, err?: string): never {
  redirect(err ? `/dashboard/maintenance/${id}?err=${encodeURIComponent(err)}` : `/dashboard/maintenance/${id}`);
}

async function setStatusAction(id: string, next: MaintenanceStatus) {
  'use server';
  const res = await safe(api.post(`/maintenance-requests/${id}/status`, { status: next }));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

async function assignAction(id: string, formData: FormData) {
  'use server';
  const locale = await getLocale();
  const m = uiT(locale).maintenanceDetailPage;
  const assignedAdminId = String(formData.get('assignedAdminId') ?? '');
  if (!assignedAdminId) back(id, m.assignment.mustChoose);
  const res = await safe(api.post(`/maintenance-requests/${id}/assign`, { assignedAdminId }));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

async function approveAction(id: string) {
  'use server';
  const res = await safe(api.post(`/maintenance-requests/${id}/approve`));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

async function rejectAction(id: string) {
  'use server';
  const res = await safe(api.post(`/maintenance-requests/${id}/reject`));
  if (res.error) back(id, res.error);
  revalidatePath(`/dashboard/maintenance/${id}`);
}

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';
const CONTACT_TILE = 'flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors';
const CONTACT_ICON = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5';

export default async function MaintenanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).maintenanceDetailPage;

  const { id } = await params;
  const sp = await searchParams;

  const [detailRes, adminsRes] = await Promise.all([
    safe(api.get<MaintenanceDetail>(`/maintenance-requests/${id}`)),
    safe(api.get<Paged<User>>('/users?role=ADMIN,MAINTENANCE_SUPERVISOR&pageSize=100')),
  ]);

  if (detailRes.error?.includes('404') || detailRes.error?.toLowerCase().includes('not found')) {
    notFound();
  }
  const req = detailRes.data;
  const admins = adminsRes.data?.data ?? [];

  if (!req) {
    return (
      <div className="space-y-5">
        <PremiumPageHero
          title={m.requestTitle}
          breadcrumbs={[
            { label: m.breadcrumbHome, href: '/dashboard' },
            { label: m.breadcrumbMaintenance, href: '/dashboard/maintenance' },
            { label: m.breadcrumbDetail },
          ]}
        />
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {m.errorLoad} {detailRes.error}
        </div>
      </div>
    );
  }

  const approved = req.reviewStatus === 'APPROVED';
  const pending = req.reviewStatus === 'PENDING';
  const rejected = req.reviewStatus === 'REJECTED';
  const transitions = NEXT_TRANSITIONS[req.status];
  const overdue = approved && !!req.dueAt && req.status !== 'CLOSED' && new Date(req.dueAt).getTime() < Date.now();
  const items = req.items ?? [];
  const slaResult: 'within' | 'after' | null =
    req.resolvedAt && req.dueAt
      ? new Date(req.resolvedAt).getTime() <= new Date(req.dueAt).getTime()
        ? 'within'
        : 'after'
      : null;

  const heroTitle = req.category
    ? tx(req.category.name)
    : `${m.requestTitle} #${req.id.slice(0, 8).toUpperCase()}`;

  const resolvedByLabel =
    req.resolvedBy === 'BOTH' ? m.resolution.bothConfirmed
    : req.resolvedBy === 'CUSTOMER' ? m.resolution.customerConfirmed
    : req.resolvedBy === 'SUPERVISOR' ? m.resolution.supervisorConfirmed
    : m.resolution.notConfirmed;
  const resolvedByCls =
    req.resolvedBy === 'BOTH' ? 'bg-success-50 text-success-700'
    : req.resolvedBy ? 'bg-info-50 text-info-700'
    : 'bg-canvas border border-hairline text-slate-500';

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={heroTitle}
        description={`${m.requestNumberPrefix} ${req.id.slice(0, 8).toUpperCase()}`}
        breadcrumbs={[
          { label: m.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbMaintenance, href: '/dashboard/maintenance' },
          { label: m.breadcrumbDetail },
        ]}
        meta={
          <>
            <MaintenanceReviewStatusBadge status={req.reviewStatus} />
            {approved && <MaintenanceStatusBadge status={req.status} />}
            {overdue && (
              <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 border border-danger-100 px-2.5 py-0.5 text-xs font-semibold">
                {m.overdueLabel}
              </span>
            )}
          </>
        }
      />

      {sp.err && (
        <div className="rounded-xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{m.errorAction}</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
          </div>
        </div>
      )}

      <PremiumDetailLayout
        sideSticky={false}
        main={
          <div className="space-y-5">
            {/* Overview */}
            <PremiumSectionCard title={m.sections.overview} icon={<Wrench />}>
              <div className="space-y-5">
                {/* Key fields — 3 columns */}
                <div className="grid grid-cols-3 gap-x-6">
                  <Field label={m.fields.category}>
                    <span className="text-[14px] font-bold text-slate-900">
                      {req.category ? tx(req.category.name) : '—'}
                    </span>
                  </Field>
                  <Field label={m.fields.priority}>
                    {req.priority
                      ? <MaintenancePriorityBadge priority={req.priority} />
                      : <span className="text-[13px] text-slate-400">—</span>}
                  </Field>
                  <Field label={m.fields.targetDate}>
                    {!approved ? (
                      <span className="text-[11px] text-slate-400">
                        {pending ? m.fields.pendingApproval : '—'}
                      </span>
                    ) : req.dueAt ? (
                      <span className={cn(
                        'text-[12px] font-semibold tabular-nums inline-flex items-center gap-1',
                        overdue ? 'text-danger-600' : 'text-slate-900',
                      )}>
                        {formatDate(req.dueAt)}
                        {overdue && (
                          <span className="rounded-full bg-danger-50 text-danger-700 text-[10px] font-semibold px-1.5 py-0.5">
                            {m.overdueLabel}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[13px] text-slate-400">—</span>
                    )}
                  </Field>
                </div>

                {/* Description box */}
                <div className="rounded-xl bg-canvas/50 border border-hairline px-4 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    {m.fields.description}
                  </p>
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {req.description}
                  </p>
                </div>

                {/* SLA result — only when resolved */}
                {slaResult && (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 shrink-0">
                      {m.fields.slaResult}
                    </p>
                    {slaResult === 'within' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 text-success-700 text-[11px] font-semibold px-2.5 py-0.5">
                        {m.fields.slaWithin}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 text-[11px] font-semibold px-2.5 py-0.5">
                        {m.fields.slaAfter}
                      </span>
                    )}
                  </div>
                )}

                {/* Dates — full-width rows, no orphan grid issues */}
                <div className="rounded-xl border border-hairline overflow-hidden divide-y divide-hairline">
                  <DateRow label={m.fields.createdAt} value={formatDateTime(req.createdAt)} />
                  <DateRow label={m.fields.updatedAt} value={formatDateTime(req.updatedAt)} />
                  {req.approvedAt && (
                    <DateRow label={m.fields.approvedAt} value={formatDateTime(req.approvedAt)} valueCls="text-success-700" />
                  )}
                  {req.rejectedAt && (
                    <DateRow label={m.fields.rejectedAt} value={formatDateTime(req.rejectedAt)} valueCls="text-danger-700" />
                  )}
                  {req.resolvedAt && (
                    <DateRow label={m.fields.resolvedAt} value={formatDateTime(req.resolvedAt)} valueCls="text-success-700" />
                  )}
                  {req.closedAt && (
                    <DateRow label={m.fields.closedAt} value={formatDateTime(req.closedAt)} />
                  )}
                </div>
              </div>
            </PremiumSectionCard>

            {/* Review */}
            <PremiumSectionCard title={m.sections.review} icon={<ClipboardList />}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 shrink-0">
                    {m.fields.reviewStatus}
                  </p>
                  <MaintenanceReviewStatusBadge status={req.reviewStatus} />
                </div>
                {pending && (
                  <>
                    <p className="text-[12px] text-slate-500">
                      {m.review.pending}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={approveAction.bind(null, req.id)}>
                        <Button type="submit" variant="primary" size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                          {m.review.approveBtn}
                        </Button>
                      </form>
                      <form action={rejectAction.bind(null, req.id)}>
                        <Button type="submit" variant="outline" size="sm" leftIcon={<XCircle className="h-4 w-4" />}>
                          {m.review.rejectBtn}
                        </Button>
                      </form>
                    </div>
                  </>
                )}
                {rejected && (
                  <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-3 py-2.5 text-[13px]">
                    {m.review.rejectedMsg}
                  </div>
                )}
                {approved && (
                  <p className="text-[12px] text-slate-500">
                    {m.review.approvedMsg(
                      req.maxHandlingSlaMinutesSnapshot != null
                        ? maintenanceSlaLabel(req.maxHandlingSlaMinutesSnapshot) ?? undefined
                        : undefined
                    )}
                  </p>
                )}
              </div>
            </PremiumSectionCard>

            {/* Resolution & rating */}
            <PremiumSectionCard title={m.sections.resolutionRating} icon={<ShieldCheck />}>
              <div className="space-y-5">
                {/* Status badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${resolvedByCls}`}>
                    {resolvedByLabel}
                  </span>
                  {overdue && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2.5 py-0.5 text-[11px] font-semibold">
                      {m.resolution.overdueLabel}
                    </span>
                  )}
                  {req.complaintAt && (
                    <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2.5 py-0.5 text-[11px] font-semibold">
                      {m.resolution.complaintLabel}
                    </span>
                  )}
                  {req.unresolvedAt && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 text-danger-700 px-2.5 py-0.5 text-[11px] font-semibold">
                      {m.resolution.unresolvedLabel}
                    </span>
                  )}
                </div>

                {/* Confirmation dates */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-hairline sm:grid-cols-4">
                  <Field label={m.fields.customerConfirmation}>
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      req.customerConfirmedResolutionAt ? 'text-success-700' : 'text-slate-400',
                    )}>
                      {req.customerConfirmedResolutionAt ? formatDateTime(req.customerConfirmedResolutionAt) : m.fields.notConfirmedYet}
                    </span>
                  </Field>
                  <Field label={m.fields.supervisorConfirmation}>
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      req.supervisorConfirmedResolutionAt ? 'text-success-700' : 'text-slate-400',
                    )}>
                      {req.supervisorConfirmedResolutionAt ? formatDateTime(req.supervisorConfirmedResolutionAt) : m.fields.notConfirmedYet}
                    </span>
                  </Field>
                  <Field label={m.fields.complaintAt}>
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      req.complaintAt ? 'text-warning-700' : 'text-slate-400',
                    )}>
                      {req.complaintAt ? formatDateTime(req.complaintAt) : '—'}
                    </span>
                  </Field>
                  <Field label={m.fields.unresolvedAt}>
                    <span className={cn(
                      'text-[12px] font-medium tabular-nums',
                      req.unresolvedAt ? 'text-danger-700' : 'text-slate-400',
                    )}>
                      {req.unresolvedAt ? formatDateTime(req.unresolvedAt) : '—'}
                    </span>
                  </Field>
                </div>

                {/* Customer rating */}
                <div className="pt-4 border-t border-hairline">
                  <Field label={m.fields.customerRating}>
                    {req.customerRating ? (
                      <div className="space-y-2 mt-0.5">
                        <Stars value={req.customerRating} />
                        {req.customerRatingText && (
                          <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{req.customerRatingText}</p>
                        )}
                        {req.customerRatingSubmittedAt && (
                          <p className="text-[11px] text-slate-400">
                            {m.fields.ratedAt(formatDateTime(req.customerRatingSubmittedAt))}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-400 mt-0.5">{m.fields.noRatingYet}</p>
                    )}
                  </Field>
                </div>
              </div>
            </PremiumSectionCard>

            {/* Items table */}
            {items.length > 0 && (
              <PremiumSectionCard title={m.sections.items} padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-canvas/50 border-b border-hairline">
                      <tr>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.items.colCategory}</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.items.colPriority}</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.items.colSla}</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.items.colWarranty}</th>
                        <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.items.colWarrantyEnd}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-canvas/40 transition-colors duration-100">
                          <td className="px-5 py-3 text-[13px] font-semibold text-slate-900">
                            {it.category ? tx(it.category.name) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <MaintenancePriorityBadge priority={it.categoryPrioritySnapshot} />
                          </td>
                          <td className="px-5 py-3 text-[12px] text-slate-600">
                            {maintenanceSlaLabel(it.handlingSlaMinutesSnapshot) ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            <WarrantyStatusBadge status={it.warrantyStatusSnapshot} />
                          </td>
                          <td className="px-5 py-3 text-[12px] text-slate-600 tabular-nums">
                            {it.warrantyEndSnapshot ? formatDate(it.warrantyEndSnapshot) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumSectionCard>
            )}

            {/* Workflow */}
            {approved && (
              <PremiumSectionCard title={m.sections.workflow}>
                {req.status === 'CLOSED' ? (
                  <p className="text-[13px] text-slate-500">{m.workflow.closedMsg}</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {m.workflow.availableActions}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {transitions.map((next) => (
                        <form key={next} action={setStatusAction.bind(null, req.id, next)}>
                          <Button type="submit" variant={ACTION_VARIANT[next]} size="sm">
                            {m.workflow.actionLabels[next]}
                          </Button>
                        </form>
                      ))}
                    </div>
                  </div>
                )}
              </PremiumSectionCard>
            )}
          </div>
        }
        side={
          <div className="space-y-5">
            <PremiumCommandPanel title={m.sections.quickLinks}>
              {req.customer && (
                <Link href={`/dashboard/customers/${req.customer.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><UserIcon /></span>
                  {m.quickLinks.clientProfile}
                </Link>
              )}
              {req.unit && (
                <Link href={`/dashboard/units/${req.unit.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><Home /></span>
                  {m.quickLinks.unitDetails}
                </Link>
              )}
              <Link href="/dashboard/maintenance" className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                {m.quickLinks.backToList}
              </Link>
            </PremiumCommandPanel>

            {/* Customer and unit */}
            <PremiumSectionCard title={m.sections.clientUnit} icon={<Home />}>
              <div className="space-y-4">
                {/* Customer */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                      <UserIcon />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">{m.client.label}</p>
                      <p className="text-[13.5px] font-bold text-slate-900 truncate">
                        {req.customer?.fullName ?? '—'}
                      </p>
                    </div>
                  </div>
                  {req.customer?.phone && (
                    <a href={`tel:${req.customer.phone}`} className={CONTACT_TILE}>
                      <span className={CONTACT_ICON}><Phone /></span>
                      <span className="text-[13px] font-medium text-slate-700 flex-1 truncate" dir="ltr">
                        {req.customer.phone}
                      </span>
                    </a>
                  )}
                  {req.customer?.email && (
                    <a href={`mailto:${req.customer.email}`} className={CONTACT_TILE}>
                      <span className={CONTACT_ICON}><Mail /></span>
                      <span className="text-[13px] font-medium text-slate-700 flex-1 truncate" dir="ltr">
                        {req.customer.email}
                      </span>
                    </a>
                  )}
                </div>

                {/* Unit */}
                <div className="pt-4 border-t border-hairline space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                      <Home />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">{m.client.unit}</p>
                      <p className="text-[16px] font-black text-brand-700 font-mono leading-none">
                        {req.unit?.code ?? '—'}
                      </p>
                    </div>
                  </div>
                  {req.unit && (
                    <p className="text-[12px] text-slate-500 ms-12">
                      {req.unit.type} · {m.client.floorLabel} {req.unit.floor}
                    </p>
                  )}
                </div>
              </div>
            </PremiumSectionCard>

            {/* Assignment */}
            {approved && (
              <PremiumSectionCard title={m.sections.assignment} icon={<UserCog />}>
                <div className="space-y-4">
                  {/* Current assignee */}
                  {req.assignedAdmin ? (
                    <div className="flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <UserCog />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">{m.assignment.currentLabel}</p>
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{req.assignedAdmin.fullName}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400">{m.assignment.notAssigned}</p>
                  )}

                  {req.status !== 'CLOSED' ? (
                    <form action={assignAction.bind(null, req.id)} className="space-y-2.5">
                      <Select
                        name="assignedAdminId"
                        inputSize="sm"
                        defaultValue={req.assignedAdminId ?? ''}
                        required
                      >
                        <option value="">{m.assignment.choosePlaceholder}</option>
                        {admins.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName} — {m.assignment.roleLabels[a.role as keyof typeof m.assignment.roleLabels] ?? a.role}
                          </option>
                        ))}
                      </Select>
                      {req.status === 'OPEN' && (
                        <p className="text-[11px] text-slate-400">
                          {m.assignment.autoAssignNote}
                        </p>
                      )}
                      <Button type="submit" variant="outline" size="sm">{m.assignment.saveBtn}</Button>
                    </form>
                  ) : (
                    <p className="text-[12px] text-slate-400">{m.assignment.closedMsg}</p>
                  )}
                </div>
              </PremiumSectionCard>
            )}

            <OwnerDocumentsCard
              ownerType="MAINTENANCE_REQUEST"
              ownerId={req.id}
              title={m.sections.documents}
            />
          </div>
        }
      />

    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        />
      ))}
      <span className="ms-1 text-xs text-slate-500 tabular-nums">{value}/5</span>
    </span>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function DateRow({
  label,
  value,
  valueCls = 'text-slate-700',
}: {
  label: string;
  value: string;
  valueCls?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span className={`text-[12px] font-medium tabular-nums shrink-0 ${valueCls}`}>{value}</span>
    </div>
  );
}
