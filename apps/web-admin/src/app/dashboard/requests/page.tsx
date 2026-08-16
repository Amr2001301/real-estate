import Link from 'next/link';
import {
  MessageSquareText,
  Phone,
  Mail,
  MessageCircle,
  AlertCircle,
  Building2,
  Home,
  Inbox,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, AdminInfoRequest } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;

interface Filters {
  page?: string;
  status?: string;
}

export default async function InfoRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = uiT(locale).pages.requests;

  function submitterBadge(req: AdminInfoRequest): { label: string; tone: 'gray' | 'info' | 'success' } {
    if (!req.userId) return { label: m.submitterTypes.visitor, tone: 'gray' };
    if (req.user?.role === 'CUSTOMER') return { label: m.submitterTypes.owner, tone: 'success' };
    return { label: m.submitterTypes.browser, tone: 'info' };
  }

  function contactOf(req: AdminInfoRequest): { name: string; phone: string | null; email: string | null } {
    return {
      name: req.user?.fullName ?? req.lead?.fullName ?? m.noVisitorName,
      phone: req.user?.phone ?? req.lead?.phone ?? null,
      email: req.user?.email ?? req.lead?.email ?? null,
    };
  }

  const STATUS_LABEL: Record<string, { label: string; tone: 'warning' | 'info' | 'gray' }> = {
    OPEN:      { label: m.statusLabels.OPEN,    tone: 'warning' },
    RESPONDED: { label: m.statusLabels.REPLIED, tone: 'info' },
    CLOSED:    { label: m.statusLabels.CLOSED,  tone: 'gray' },
  };

  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const statusFilter = sp.status ?? '';

  const pageQs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (statusFilter) pageQs.set('status', statusFilter);

  // Two fetches: paginated display + wide snapshot for accurate KPI counts.
  const [res, snapshotRes] = await Promise.all([
    safe(api.get<Paged<AdminInfoRequest>>(`/info-requests?${pageQs.toString()}`)),
    safe(api.get<Paged<AdminInfoRequest>>('/info-requests?pageSize=500')),
  ]);

  const rows = res.data?.data ?? [];
  const total = res.data?.meta.total ?? 0;
  const snapshot = snapshotRes.data?.data ?? [];
  const grandTotal = snapshotRes.data?.meta.total ?? snapshot.length;
  const openCount = snapshot.filter((r) => r.status === 'OPEN').length;
  const respondedCount = snapshot.filter((r) => r.status === 'RESPONDED').length;
  const closedCount = snapshot.filter((r) => r.status === 'CLOSED').length;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: m.kpi.total,
            value: grandTotal,
            icon: <MessageSquareText />,
            tone: 'brand',
            primary: true,
          },
          {
            label: m.kpi.open,
            value: openCount,
            icon: <Inbox />,
            tone: 'warning',
          },
          {
            label: m.kpi.replied,
            value: respondedCount,
            icon: <CheckCircle2 />,
            tone: 'success',
          },
          {
            label: m.kpi.closed,
            value: closedCount,
            icon: <Archive />,
            tone: 'info',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {res.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorPrefix} {res.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/requests">
        <PremiumFilterField label={m.filter.statusLabel} htmlFor="req-status">
          <Select id="req-status" name="status" inputSize="sm" defaultValue={statusFilter} className="w-40 shrink-0">
            <option value="">{m.filter.all}</option>
            <option value="OPEN">{m.filter.open}</option>
            <option value="RESPONDED">{m.filter.replied}</option>
            <option value="CLOSED">{m.filter.closed}</option>
          </Select>
        </PremiumFilterField>

        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {statusFilter && (
            <Link href={'/dashboard/requests' as never}>
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Requests table ───────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<MessageSquareText />}
        title={m.sectionTitle}
        description={m.sectionDesc}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {total.toLocaleString('ar-EG')} {m.inquirySuffix}
          </span>
        }
      >
        {rows.length === 0 && !res.error ? (
          <PremiumEmptyState
            icon={<MessageSquareText />}
            title={m.empty.title}
            description={m.empty.description}
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">{m.cols.sender}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.type}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.contact}</th>
                  <th className="text-start py-3 px-4">{m.cols.message}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.context}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.status}</th>
                  <th className="text-start py-3 ps-4 pe-5 whitespace-nowrap">{m.cols.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((req) => {
                  const contact = contactOf(req);
                  const badge = submitterBadge(req);
                  const status = STATUS_LABEL[req.status] ?? { label: req.status, tone: 'gray' as const };
                  const waDigits = contact.phone?.replace(/\D/g, '') ?? '';
                  const projectName = req.project ? tx(req.project.name) : null;
                  return (
                    <tr
                      key={req.id}
                      className="group border-b border-hairline align-top hover:bg-canvas/40 transition-colors duration-100"
                    >
                      {/* Sender */}
                      <td className="py-3.5 ps-5 pe-4 min-w-[160px]">
                        <p className="font-semibold text-[13px] text-slate-900 leading-snug">
                          {contact.name}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5 leading-none">
                          #{req.id.slice(0, 8).toUpperCase()}
                        </p>
                      </td>

                      {/* Type badge */}
                      <td className="py-3.5 px-4">
                        <Badge tone={badge.tone} variant="soft" size="sm">
                          {badge.label}
                        </Badge>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 min-w-[210px]">
                        <div className="flex flex-col gap-1.5">
                          {contact.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <a
                                href={`tel:${contact.phone}`}
                                className="font-mono text-xs text-slate-700 hover:text-brand-700 transition-colors"
                                dir="ltr"
                              >
                                {contact.phone}
                              </a>
                              {waDigits && (
                                <a
                                  href={`https://wa.me/${waDigits}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={m.whatsappLabel}
                                  title={`${m.whatsappLabel}: ${contact.phone}`}
                                  className="shrink-0 text-success-600 hover:text-success-700 transition-colors"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          ) : null}
                          {contact.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-xs text-slate-600 hover:text-brand-700 transition-colors truncate max-w-[170px]"
                                dir="ltr"
                              >
                                {contact.email}
                              </a>
                            </div>
                          ) : null}
                          {!contact.phone && !contact.email && (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Message */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {req.message}
                        </p>
                      </td>

                      {/* Context (project / unit) */}
                      <td className="py-3.5 px-4 min-w-[140px]">
                        {projectName ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{projectName}</span>
                          </div>
                        ) : null}
                        {req.unit ? (
                          <div className={cn('flex items-center gap-1.5', projectName ? 'mt-1' : '')}>
                            <Home className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {req.unit.code}
                            </span>
                          </div>
                        ) : null}
                        {!projectName && !req.unit && (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge tone={status.tone} variant="soft" size="sm" dot>
                          {status.label}
                        </Badge>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 ps-4 pe-5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(req.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {res.data && total > PAGE_SIZE && (
        <Pagination
          page={res.data.meta.page}
          pageSize={res.data.meta.pageSize}
          total={total}
          basePath="/dashboard/requests"
          params={{ status: statusFilter || undefined }}
          locale={locale}
        />
      )}
    </div>
  );
}
