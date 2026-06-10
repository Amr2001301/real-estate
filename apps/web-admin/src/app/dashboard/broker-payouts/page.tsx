import Link from 'next/link';
import { Wallet, Plus, Eye, Briefcase } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerPayout, Broker, Paged } from '@/lib/types';
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

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['brokerId', 'status', 'period', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [payoutsRes, brokersRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerPayout>>(`/broker-payouts?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
  ]);

  const paged = payoutsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدفوعات الوسطاء"
        description="دفعات عمولات معتمدة تصرفها الشركة للوسطاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'مدفوعات الوسطاء' },
        ]}
        actions={
          <Link href="/dashboard/broker-payouts/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              دفعة جديدة
            </Button>
          </Link>
        }
      />

      {payoutsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المدفوعات: {payoutsRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/broker-payouts"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Select name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.companyName}</option>
          ))}
        </Select>
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
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
          placeholder="الفترة (مثال: 2026-05)"
          dir="ltr"
          defaultValue={sp.period ?? ''}
          className="w-44 shrink-0"
        />
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-36 shrink-0" />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-36 shrink-0" />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-payouts">
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
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">الفترة</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي</th>
                <th className="text-start font-semibold py-3 px-4">صافي</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الإنشاء</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الصرف</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<Wallet />}
                      title="لا توجد مدفوعات بعد"
                      description="أنشئ أول دفعة بعد اعتماد عمولات الوسطاء."
                      action={
                        <Link href="/dashboard/broker-payouts/new">
                          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                            دفعة جديدة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors align-top">
                  <td className="py-3 ps-5 pe-4 font-mono text-xs text-slate-700" dir="ltr">{p.payoutNumber}</td>
                  <td className="py-3 px-4">
                    {p.broker ? (
                      <Link
                        href={`/dashboard/brokers/${p.broker.id}` as never}
                        className="text-sm text-slate-900 hover:text-brand-700 inline-flex items-center gap-1.5"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        {p.broker.companyName}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 font-mono" dir="ltr">{p.period ?? '—'}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(p.totalGross)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">{formatCurrency(p.totalNet)}</td>
                  <td className="py-3 px-4">
                    <BrokerPayoutStatusBadge status={p.status} />
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500">{formatDate(p.createdAt)}</td>
                  <td className="py-3 px-4 text-2xs text-slate-500">{formatDate(p.paidAt)}</td>
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/dashboard/broker-payouts/${p.id}` as never}>
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
            basePath="/dashboard/broker-payouts"
            params={{
              brokerId: sp.brokerId,
              status: sp.status,
              period: sp.period,
              from: sp.from,
              to: sp.to,
            }}
          />
        )}
      </Card>
    </div>
  );
}
