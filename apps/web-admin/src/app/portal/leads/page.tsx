import Link from 'next/link';
import { Plus, Users, Mail, Phone, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalLead } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerLeadStatusBadge, LeadStageBadge } from '@/components/badges';

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
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.brokerApprovalStatus) qs.set('brokerApprovalStatus', sp.brokerApprovalStatus);
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.q) qs.set('q', sp.q);

  const r = await safe(api.get<Paged<PortalLead>>(`/portal/leads?${qs.toString()}`));
  const paged = r.data;
  const rows = paged?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="فرصي"
        description="الفرص (Leads) التي قمتَ بإرسالها للإدارة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الفرص' },
        ]}
        actions={
          <Link href="/portal/leads/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              فرصة جديدة
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الفرص: {r.error}
        </div>
      )}

      <form
        method="get"
        action="/portal/leads"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث: اسم / هاتف / بريد"
          defaultValue={sp.q ?? ''}
          className="w-64 shrink-0"
        />
        <Select
          name="brokerApprovalStatus"
          inputSize="sm"
          defaultValue={sp.brokerApprovalStatus ?? ''}
          className="w-44 shrink-0"
        >
          <option value="">كل حالات المراجعة</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">موافق عليه</option>
          <option value="REJECTED">مرفوض</option>
          <option value="DUPLICATE">مكرر</option>
        </Select>
        <Select
          name="stage"
          inputSize="sm"
          defaultValue={sp.stage ?? ''}
          className="w-40 shrink-0"
        >
          <option value="">كل المراحل</option>
          <option value="NEW">جديد</option>
          <option value="INTERESTED">مهتم</option>
          <option value="VISIT">زيارة</option>
          <option value="NEGOTIATION">تفاوض</option>
          <option value="WON">فوز</option>
          <option value="LOST">خسارة</option>
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {(sp.q || sp.brokerApprovalStatus || sp.stage) && (
            <Link href="/portal/leads">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">التواصل</th>
                <th className="text-start font-semibold py-3 px-4">المشروع / الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">المراجعة</th>
                <th className="text-start font-semibold py-3 px-4">المرحلة</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<Users />}
                      title="لا توجد فرص بعد"
                      description="ابدأ بإرسال أول فرصة للإدارة."
                      action={
                        <Link href="/portal/leads/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            فرصة جديدة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-hairline align-middle hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="py-3 ps-5 pe-4">
                    <p className="font-semibold text-slate-900 truncate">{l.fullName}</p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-0.5 text-2xs text-slate-500" dir="ltr">
                      <a
                        href={`tel:${l.phone}`}
                        className="inline-flex items-center gap-1 hover:text-brand-700"
                      >
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        {l.phone}
                      </a>
                      {l.email && (
                        <a
                          href={`mailto:${l.email}`}
                          className="inline-flex items-center gap-1 hover:text-brand-700"
                        >
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{l.email}</span>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-700 truncate max-w-[200px]">
                      {l.projectInterest ? tx(l.projectInterest.name) : '—'}
                    </p>
                    {l.unitInterest && (
                      <p className="text-2xs text-slate-400 font-mono mt-0.5" dir="ltr">
                        {l.unitInterest.code}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {l.brokerApprovalStatus && (
                      <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <LeadStageBadge stage={l.stage} />
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                    {formatDate(l.brokerSubmittedAt ?? l.createdAt)}
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/portal/leads/${l.id}` as never}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                      >
                        عرض
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/leads"
            params={{
              q: sp.q,
              brokerApprovalStatus: sp.brokerApprovalStatus,
              stage: sp.stage,
            }}
          />
        )}
      </Card>
    </div>
  );
}
