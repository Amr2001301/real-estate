import Link from 'next/link';
import {
  Plus,
  Briefcase,
  CheckCircle2,
  PauseCircle,
  Hourglass,
  Eye,
  Pencil,
  Users as UsersIcon,
  ShieldCheck,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerStatus, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  status?: string;
  city?: string;
  q?: string;
}

const PAGE_SIZE = 20;

export default async function BrokersPage({
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
  if (sp.status) qs.set('status', sp.status);
  if (sp.city) qs.set('city', sp.city);
  if (sp.q) qs.set('q', sp.q);

  const [pagedRes, snapshotRes] = await Promise.all([
    safe(api.get<Paged<Broker>>(`/brokers?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
  ]);

  const paged = pagedRes.data;
  const snapshot = snapshotRes.data;
  const rows = paged?.data ?? [];
  const allBrokers = snapshot?.data ?? [];

  const cities = Array.from(
    new Set(allBrokers.map((b) => b.city).filter((c): c is string => Boolean(c))),
  );

  const total = paged?.meta.total ?? allBrokers.length;
  const active = allBrokers.filter((b) => b.status === 'ACTIVE').length;
  const pending = allBrokers.filter((b) => b.status === 'PENDING').length;
  const suspended = allBrokers.filter((b) => b.status === 'SUSPENDED').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="الوسطاء"
        description="إدارة شركات الوساطة العقارية وصلاحياتها على المشاريع والوحدات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء' },
        ]}
        actions={
          <Link href={'/dashboard/brokers/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إضافة وسيط
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي الوسطاء"
          value={total}
          icon={<Briefcase />}
          tone="brand"
        />
        <PageKpiCard
          label="نشط"
          value={active}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <PageKpiCard
          label="قيد الانضمام"
          value={pending}
          icon={<Hourglass />}
          tone="warning"
        />
        <PageKpiCard
          label="موقوف"
          value={suspended}
          icon={<PauseCircle />}
          tone="danger"
        />
      </div>

      {pagedRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل قائمة الوسطاء: {pagedRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/brokers"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث: اسم / رمز / بريد / هاتف"
          defaultValue={sp.q ?? ''}
          className="w-64 shrink-0"
        />
        <Select
          name="status"
          inputSize="sm"
          defaultValue={sp.status ?? ''}
          className="w-40 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد الانضمام</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">موقوف</option>
          <option value="TERMINATED">منتهي</option>
        </Select>
        <Select
          name="city"
          inputSize="sm"
          defaultValue={sp.city ?? ''}
          className="w-40 shrink-0"
        >
          <option value="">كل المدن</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {(sp.status || sp.city || sp.q) && (
            <Link href="/dashboard/brokers">
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
                <th className="text-start font-semibold py-3 ps-5 pe-4">الشركة</th>
                <th className="text-start font-semibold py-3 px-4">الرمز</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المدينة</th>
                <th className="text-start font-semibold py-3 px-4">الموظفون</th>
                <th className="text-start font-semibold py-3 px-4">المشاريع</th>
                <th className="text-start font-semibold py-3 px-4">الوحدات</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الإضافة</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<Briefcase />}
                      title="لا يوجد وسطاء بعد"
                      description="ابدأ بإضافة أول شركة وساطة عقارية."
                      action={
                        <Link href={'/dashboard/brokers/new' as never}>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            إضافة وسيط
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((b) => {
                const counts = b._count ?? {
                  brokerUsers: 0,
                  projectAccess: 0,
                  unitAccess: 0,
                };
                return (
                  <tr
                    key={b.id}
                    className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 ps-5 pe-4">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/brokers/${b.id}` as never}
                          className="font-semibold text-slate-900 hover:text-brand-700 transition-colors"
                        >
                          {b.companyName}
                        </Link>
                        {b.commercialName && (
                          <p className="text-xs text-slate-500 mt-0.5">{b.commercialName}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700" dir="ltr">
                      {b.code}
                    </td>
                    <td className="py-3 px-4">
                      <BrokerStatusBadge status={b.status as BrokerStatus} />
                    </td>
                    <td className="py-3 px-4 text-slate-600">{b.city || '—'}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">{counts.brokerUsers}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">{counts.projectAccess}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">{counts.unitAccess}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="py-3 ps-4 pe-5">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/brokers/${b.id}` as never}>
                          <IconButton label="عرض" variant="ghost" size="sm">
                            <Eye />
                          </IconButton>
                        </Link>
                        <Link href={`/dashboard/brokers/${b.id}/edit` as never}>
                          <IconButton label="تعديل" variant="ghost" size="sm">
                            <Pencil />
                          </IconButton>
                        </Link>
                        <Link href={`/dashboard/brokers/${b.id}/users` as never}>
                          <IconButton label="الموظفون" variant="ghost" size="sm">
                            <UsersIcon />
                          </IconButton>
                        </Link>
                        <Link href={`/dashboard/brokers/${b.id}/access` as never}>
                          <IconButton label="الصلاحيات" variant="ghost" size="sm">
                            <ShieldCheck />
                          </IconButton>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/dashboard/brokers"
            params={{ status: sp.status, city: sp.city, q: sp.q }}
          />
        )}
      </Card>
    </div>
  );
}
