import type { ReactNode } from 'react';
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
  MapPin,
  Building2,
  Home,
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

  // Safe insights — derived from already-fetched unfiltered snapshot
  const totalEmployees = allBrokers.reduce((s, b) => s + (b._count?.brokerUsers ?? 0), 0);
  const totalProjectAccess = allBrokers.reduce((s, b) => s + (b._count?.projectAccess ?? 0), 0);

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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard label="إجمالي الوسطاء" value={total} icon={<Briefcase />} tone="brand" />
        <PageKpiCard label="نشط" value={active} icon={<CheckCircle2 />} tone="success" />
        <PageKpiCard label="قيد الانضمام" value={pending} icon={<Hourglass />} tone="warning" />
        <PageKpiCard label="موقوف" value={suspended} icon={<PauseCircle />} tone="danger" />
      </div>

      {/* Insight strip — shown only when platform has brokers */}
      {allBrokers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs">
          <InsightItem
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-success-500" />}
            label="نشط من الإجمالي"
            value={`${active} / ${total}`}
          />
          <div className="w-px h-4 bg-hairline hidden sm:block" aria-hidden />
          <InsightItem
            icon={<UsersIcon className="h-3.5 w-3.5 text-brand-400" />}
            label="إجمالي الموظفين"
            value={String(totalEmployees)}
          />
          <div className="w-px h-4 bg-hairline hidden sm:block" aria-hidden />
          <InsightItem
            icon={<Building2 className="h-3.5 w-3.5 text-brand-400" />}
            label="صلاحيات المشاريع"
            value={String(totalProjectAccess)}
          />
          <div className="w-px h-4 bg-hairline hidden sm:block" aria-hidden />
          <InsightItem
            icon={<MapPin className="h-3.5 w-3.5 text-brand-400" />}
            label="مدن"
            value={String(cities.length)}
          />
        </div>
      )}

      {pagedRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل قائمة الوسطاء: {pagedRes.error}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="get"
        action="/dashboard/brokers"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث: اسم / رمز / بريد / هاتف"
          defaultValue={sp.q ?? ''}
          className="w-64 shrink-0"
        />
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد الانضمام</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">موقوف</option>
          <option value="TERMINATED">منتهي</option>
        </Select>
        <Select name="city" inputSize="sm" defaultValue={sp.city ?? ''} className="w-40 shrink-0">
          <option value="">كل المدن</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.status || sp.city || sp.q) && (
            <Link href="/dashboard/brokers">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* Broker table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الشركة</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المدينة</th>
                <th className="text-start font-semibold py-3 px-4">الموظفون</th>
                <th className="text-start font-semibold py-3 px-4">المشاريع</th>
                <th className="text-start font-semibold py-3 px-4">الوحدات</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الإضافة</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
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
                const counts = b._count ?? { brokerUsers: 0, projectAccess: 0, unitAccess: 0 };
                return (
                  <tr
                    key={b.id}
                    className="hover:bg-surface-muted/40 transition-colors align-middle"
                  >
                    {/* Company: Arabic name + English name + code chip in one cell */}
                    <td className="py-3.5 ps-5 pe-4">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/brokers/${b.id}` as never}
                          className="font-semibold text-slate-900 hover:text-brand-700 transition-colors block truncate max-w-[260px]"
                        >
                          {b.companyName}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {b.commercialName && (
                            <span className="text-2xs text-slate-400 truncate max-w-[200px]">
                              {b.commercialName}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-px font-mono text-2xs text-slate-500 shrink-0 leading-none"
                            dir="ltr"
                          >
                            {b.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <BrokerStatusBadge status={b.status as BrokerStatus} />
                    </td>

                    <td className="py-3.5 px-4">
                      {b.city ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          {b.city}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <MetricChip icon={<UsersIcon />} value={counts.brokerUsers} />
                    </td>
                    <td className="py-3.5 px-4">
                      <MetricChip icon={<Building2 />} value={counts.projectAccess} />
                    </td>
                    <td className="py-3.5 px-4">
                      <MetricChip icon={<Home />} value={counts.unitAccess} />
                    </td>

                    <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(b.createdAt)}
                    </td>

                    <td className="py-3.5 ps-4 pe-5">
                      <div className="flex items-center gap-0.5">
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

// ── Internal helpers ───────────────────────────────────────────────────────

function InsightItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

function MetricChip({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2 py-1 text-xs font-medium tabular-nums text-slate-700 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:text-slate-400">
      {icon}
      {value}
    </span>
  );
}
