import Link from 'next/link';
import { Wallet, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalPayout } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerPayoutStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك',
  CASH: 'نقدي',
  OTHER: 'أخرى',
};

interface Search {
  page?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function PortalPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['status', 'period', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const r = await safe(api.get<Paged<PortalPayout>>(`/portal/payouts?${qs.toString()}`));
  const paged = r.data;
  const rows = paged?.data ?? [];

  const totalNet = rows.reduce((s, p) => s + Number(p.totalNet || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدفوعاتي"
        description="الدفعات المالية المرتبطة بعمولاتك. مدفوعة = تم صرفها خارجياً وسجلت الإدارة الإشعار."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'المدفوعات' },
        ]}
        meta={
          rows.length > 0 ? (
            <span className="text-xs text-slate-600 tabular-nums">
              صافي هذه الصفحة: {formatCurrency(totalNet)}
            </span>
          ) : undefined
        }
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المدفوعات: {r.error}
        </div>
      )}

      <form
        method="get"
        action="/portal/payouts"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-44 shrink-0">
          <option value="">كل الحالات</option>
          <option value="DRAFT">مسودة</option>
          <option value="APPROVED">موافق عليها</option>
          <option value="PROCESSING">قيد التنفيذ</option>
          <option value="PAID">مدفوعة</option>
          <option value="CANCELLED">ملغاة</option>
        </Select>
        <Input
          name="period"
          inputSize="sm"
          placeholder="YYYY-MM"
          dir="ltr"
          defaultValue={sp.period ?? ''}
          className="w-32 shrink-0"
        />
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-40 shrink-0" />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-40 shrink-0" />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.status || sp.period || sp.from || sp.to) && (
            <Link href="/portal/payouts">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم الدفعة</th>
                <th className="text-start font-semibold py-3 px-4">الفترة</th>
                <th className="text-start font-semibold py-3 px-4">صافي</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الدفع</th>
                <th className="text-start font-semibold py-3 px-4">طريقة الدفع</th>
                <th className="text-start font-semibold py-3 px-4">مرجع</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<Wallet />}
                      title="لا توجد مدفوعات بعد"
                      description="تظهر هنا عندما تجمّع الإدارة عمولاتك في دفعة وتعتمدها."
                    />
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors">
                  <td className="py-3 ps-5 pe-4 font-mono text-xs text-slate-700" dir="ltr">{p.payoutNumber}</td>
                  <td className="py-3 px-4 text-xs text-slate-700 font-mono" dir="ltr">{p.period ?? '—'}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">{formatCurrency(p.totalNet)}</td>
                  <td className="py-3 px-4">
                    <BrokerPayoutStatusBadge status={p.status} />
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500">{formatDate(p.paidAt)}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {p.paymentMethod ? METHOD_LABEL[p.paymentMethod] : '—'}
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500 font-mono" dir="ltr">
                    {p.paymentReference ?? '—'}
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/portal/payouts/${p.id}` as never}>
                      <IconButton label="عرض" variant="ghost" size="sm">
                        <Eye />
                      </IconButton>
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
            basePath="/portal/payouts"
            params={{ status: sp.status, period: sp.period, from: sp.from, to: sp.to }}
          />
        )}
      </Card>
    </div>
  );
}
