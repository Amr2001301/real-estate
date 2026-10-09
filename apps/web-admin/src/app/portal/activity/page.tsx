import Link from 'next/link';
import {
  Activity,
  UserPlus,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Copy,
  BookmarkCheck,
  FileText,
  FilePen,
  BadgePercent,
  Ban,
  Wallet,
  CircleDollarSign,
  Clock,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  PortalActivityItem,
  PortalActivityType,
} from '@/lib/types';
import { tx, formatDateTime } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
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
  type?: string;
  entityType?: string;
}

const PAGE_SIZE = 30;

const TONE: Record<PortalActivityType, string> = {
  LEAD_SUBMITTED: 'bg-blue-100 text-blue-700',
  VISIT_REQUESTED: 'bg-purple-100 text-purple-700',
  LEAD_APPROVED: 'bg-green-100 text-green-700',
  LEAD_REJECTED: 'bg-red-100 text-red-700',
  LEAD_MARKED_DUPLICATE: 'bg-amber-100 text-amber-700',
  RESERVATION_CREATED: 'bg-indigo-100 text-indigo-700',
  CONTRACT_CREATED: 'bg-cyan-100 text-cyan-700',
  CONTRACT_SIGNED: 'bg-emerald-100 text-emerald-700',
  COMMISSION_EARNED: 'bg-teal-100 text-teal-700',
  COMMISSION_APPROVED: 'bg-green-100 text-green-700',
  COMMISSION_REJECTED: 'bg-red-100 text-red-700',
  COMMISSION_CANCELLED: 'bg-gray-200 text-gray-600',
  PAYOUT_CREATED: 'bg-blue-100 text-blue-700',
  PAYOUT_APPROVED: 'bg-cyan-100 text-cyan-700',
  PAYOUT_PROCESSING: 'bg-amber-100 text-amber-700',
  PAYOUT_PAID: 'bg-emerald-100 text-emerald-700',
  PAYOUT_CANCELLED: 'bg-gray-200 text-gray-600',
};

function ActivityIcon({ type }: { type: PortalActivityType }) {
  const className = 'h-4 w-4';
  switch (type) {
    case 'LEAD_SUBMITTED':
      return <UserPlus className={className} />;
    case 'VISIT_REQUESTED':
      return <CalendarClock className={className} />;
    case 'LEAD_APPROVED':
      return <CheckCircle2 className={className} />;
    case 'LEAD_REJECTED':
      return <XCircle className={className} />;
    case 'LEAD_MARKED_DUPLICATE':
      return <Copy className={className} />;
    case 'RESERVATION_CREATED':
      return <BookmarkCheck className={className} />;
    case 'CONTRACT_CREATED':
      return <FileText className={className} />;
    case 'CONTRACT_SIGNED':
      return <FilePen className={className} />;
    case 'COMMISSION_EARNED':
    case 'COMMISSION_APPROVED':
      return <BadgePercent className={className} />;
    case 'COMMISSION_REJECTED':
      return <XCircle className={className} />;
    case 'COMMISSION_CANCELLED':
      return <Ban className={className} />;
    case 'PAYOUT_CREATED':
    case 'PAYOUT_APPROVED':
      return <Wallet className={className} />;
    case 'PAYOUT_PROCESSING':
      return <Clock className={className} />;
    case 'PAYOUT_PAID':
      return <CircleDollarSign className={className} />;
    case 'PAYOUT_CANCELLED':
      return <Ban className={className} />;
  }
}

function payloadSummary(item: PortalActivityItem, m: ReturnType<typeof portalDashboardT>): string | null {
  const p = item.payload;
  const pl = m.activity.payload;
  if (item.type === 'LEAD_REJECTED' && typeof p.reason === 'string') {
    return pl.reasonFn(p.reason);
  }
  if (item.type === 'LEAD_MARKED_DUPLICATE' && typeof p.reason === 'string') {
    return pl.noteFn(p.reason);
  }
  if (item.type === 'LEAD_SUBMITTED' && p.isDuplicate === true) {
    return pl.duplicate;
  }
  if (item.type === 'VISIT_REQUESTED' && typeof p.preferredDate === 'string') {
    return pl.preferredDateFn(p.preferredDate.slice(0, 10));
  }
  return null;
}

export default async function PortalActivityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalDashboardT(locale);
  const t = m.activity;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.type) qs.set('type', sp.type);
  if (sp.entityType) qs.set('entityType', sp.entityType);

  const r = await safe(
    api.get<Paged<PortalActivityItem>>(`/portal/activity?${qs.toString()}`),
  );
  const paged = r.data;
  const rows = paged?.data ?? [];

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: t.title },
        ]}
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {t.loadErrorFn(r.error)}
        </div>
      )}

      <PremiumFilterBar
        method="get"
        action="/portal/activity"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">{t.filter}</Button>
            {(sp.type || sp.entityType) && (
              <Link href="/portal/activity">
                <Button type="button" variant="ghost" size="sm">{m.common.clear}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={t.eventType}>
          <Select
            name="type"
            inputSize="sm"
            defaultValue={sp.type ?? ''}
            className="w-52"
          >
            <option value="">{t.allEvents}</option>
            {(Object.keys(m.activityType) as PortalActivityType[]).map((type) => (
              <option key={type} value={type}>
                {m.activityType[type]}
              </option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={t.entityType}>
          <Select
            name="entityType"
            inputSize="sm"
            defaultValue={sp.entityType ?? ''}
            className="w-44"
          >
            <option value="">{t.allEntities}</option>
            <option value="Lead">{t.entities.Lead}</option>
            <option value="VisitRequest">{t.entities.VisitRequest}</option>
            <option value="Reservation">{t.entities.Reservation}</option>
            <option value="Contract">{t.entities.Contract}</option>
            <option value="Commission">{t.entities.Commission}</option>
            <option value="Payout">{t.entities.Payout}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        icon={<Activity />}
        title={t.logTitle}
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Activity />}
            title={t.emptyTitle}
            description={t.emptyDescription}
          />
        ) : (
          <ol className="divide-y divide-hairline">
            {rows.map((item) => {
              const linkHref =
                item.entityType === 'VisitRequest'
                  ? '/portal/visits'
                  : item.entityType === 'Reservation'
                    ? `/portal/reservations/${item.entityId}`
                    : item.entityType === 'Contract'
                      ? `/portal/contracts/${item.entityId}`
                      : item.entityType === 'Commission'
                        ? `/portal/commissions/${item.entityId}`
                        : item.entityType === 'Payout'
                          ? `/portal/payouts/${item.entityId}`
                          : item.lead
                            ? `/portal/leads/${item.lead.id}`
                            : '/portal/activity';
              return (
                <li key={item.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0 mt-0.5 ${TONE[item.type]}`}
                    >
                      <ActivityIcon type={item.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={linkHref as never}
                          className="font-bold text-slate-900 hover:text-brand-700 text-sm"
                        >
                          {m.activityType[item.type]}
                        </Link>
                        <time className="text-2xs text-slate-500 tabular-nums whitespace-nowrap shrink-0" dir="ltr">
                          {formatDateTime(item.createdAt, locale)}
                        </time>
                      </div>
                      {item.lead ? (
                        <>
                          <p className="mt-0.5 text-sm text-slate-700">
                            {item.lead.fullName}{' '}
                            <span className="text-2xs text-slate-400" dir="ltr">
                              {item.lead.phone}
                            </span>
                          </p>
                          <p className="text-2xs text-slate-500 mt-0.5">
                            {item.lead.projectInterest
                              ? tx(item.lead.projectInterest.name, locale)
                              : t.noProject}
                            {item.lead.unitInterest && (
                              <>
                                {' • '}
                                <span className="font-mono" dir="ltr">
                                  {item.lead.unitInterest.code}
                                </span>
                              </>
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="mt-0.5 text-2xs text-slate-500">
                          {t.companyLevel}
                        </p>
                      )}
                      {payloadSummary(item, m) && (
                        <p className="mt-1.5 text-xs text-slate-700 rounded-lg bg-surface-muted border border-hairline px-2.5 py-1.5">
                          {payloadSummary(item, m)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/activity"
            locale={locale}
            params={{ type: sp.type, entityType: sp.entityType }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
