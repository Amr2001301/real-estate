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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  type?: string;
  entityType?: string;
}

const PAGE_SIZE = 30;

const LABEL: Record<PortalActivityType, string> = {
  LEAD_SUBMITTED: 'إرسال فرصة',
  VISIT_REQUESTED: 'طلب زيارة',
  LEAD_APPROVED: 'اعتماد فرصة',
  LEAD_REJECTED: 'رفض فرصة',
  LEAD_MARKED_DUPLICATE: 'فرصة مكررة',
  RESERVATION_CREATED: 'إنشاء حجز',
  CONTRACT_CREATED: 'إنشاء عقد',
  CONTRACT_SIGNED: 'توقيع عقد',
  COMMISSION_EARNED: 'استحقاق عمولة',
  COMMISSION_APPROVED: 'اعتماد عمولة',
  COMMISSION_REJECTED: 'رفض عمولة',
  COMMISSION_CANCELLED: 'إلغاء عمولة',
  PAYOUT_CREATED: 'إنشاء دفعة',
  PAYOUT_APPROVED: 'اعتماد دفعة',
  PAYOUT_PROCESSING: 'دفعة قيد التنفيذ',
  PAYOUT_PAID: 'صرف دفعة',
  PAYOUT_CANCELLED: 'إلغاء دفعة',
};

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

function payloadSummary(item: PortalActivityItem): string | null {
  const p = item.payload;
  if (item.type === 'LEAD_REJECTED' && typeof p.reason === 'string') {
    return `السبب: ${p.reason}`;
  }
  if (item.type === 'LEAD_MARKED_DUPLICATE' && typeof p.reason === 'string') {
    return `ملاحظة: ${p.reason}`;
  }
  if (item.type === 'LEAD_SUBMITTED' && p.isDuplicate === true) {
    return 'تم تسجيل العميل بحالة "مكرر"';
  }
  if (item.type === 'VISIT_REQUESTED' && typeof p.preferredDate === 'string') {
    return `التاريخ المقترح: ${p.preferredDate.slice(0, 10)}`;
  }
  return null;
}

export default async function PortalActivityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
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
      <PageHeader
        title="النشاط"
        description="سجل أحداث الفرص والزيارات الخاصة بشركة الوساطة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'النشاط' },
        ]}
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل النشاط: {r.error}
        </div>
      )}

      <form
        method="get"
        action="/portal/activity"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Select
          name="type"
          inputSize="sm"
          defaultValue={sp.type ?? ''}
          className="w-52 shrink-0"
        >
          <option value="">كل الأحداث</option>
          <option value="LEAD_SUBMITTED">إرسال فرصة</option>
          <option value="VISIT_REQUESTED">طلب زيارة</option>
          <option value="LEAD_APPROVED">اعتماد فرصة</option>
          <option value="LEAD_REJECTED">رفض فرصة</option>
          <option value="LEAD_MARKED_DUPLICATE">فرصة مكررة</option>
          <option value="RESERVATION_CREATED">إنشاء حجز</option>
          <option value="CONTRACT_CREATED">إنشاء عقد</option>
          <option value="CONTRACT_SIGNED">توقيع عقد</option>
          <option value="COMMISSION_EARNED">استحقاق عمولة</option>
          <option value="COMMISSION_APPROVED">اعتماد عمولة</option>
          <option value="COMMISSION_REJECTED">رفض عمولة</option>
          <option value="COMMISSION_CANCELLED">إلغاء عمولة</option>
          <option value="PAYOUT_CREATED">إنشاء دفعة</option>
          <option value="PAYOUT_APPROVED">اعتماد دفعة</option>
          <option value="PAYOUT_PROCESSING">دفعة قيد التنفيذ</option>
          <option value="PAYOUT_PAID">صرف دفعة</option>
          <option value="PAYOUT_CANCELLED">إلغاء دفعة</option>
        </Select>
        <Select
          name="entityType"
          inputSize="sm"
          defaultValue={sp.entityType ?? ''}
          className="w-44 shrink-0"
        >
          <option value="">كل الكيانات</option>
          <option value="Lead">الفرص</option>
          <option value="VisitRequest">الزيارات</option>
          <option value="Reservation">الحجوزات</option>
          <option value="Contract">العقود</option>
          <option value="Commission">العمولات</option>
          <option value="Payout">المدفوعات</option>
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {(sp.type || sp.entityType) && (
            <Link href="/portal/activity">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Activity />}
            title="لا يوجد نشاط بعد"
            description="ستظهر هنا أحداث الفرص والزيارات فور حدوثها."
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
                          {LABEL[item.type]}
                        </Link>
                        <time className="text-2xs text-slate-500 tabular-nums whitespace-nowrap shrink-0" dir="ltr">
                          {formatDateTime(item.createdAt)}
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
                              ? tx(item.lead.projectInterest.name)
                              : 'بدون مشروع'}
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
                          حدث على مستوى شركة الوساطة
                        </p>
                      )}
                      {payloadSummary(item) && (
                        <p className="mt-1.5 text-xs text-slate-700 rounded-lg bg-surface-muted border border-hairline px-2.5 py-1.5">
                          {payloadSummary(item)}
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
            params={{ type: sp.type, entityType: sp.entityType }}
          />
        )}
      </Card>
    </div>
  );
}
