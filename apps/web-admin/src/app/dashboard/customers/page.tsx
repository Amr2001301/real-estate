import Link from 'next/link';
import {
  UserCheck,
  AlertCircle,
  Phone,
  Mail,
  Download,
  Search,
  Eye,
  Info,
  ShieldCheck,
  FileText,
  Wrench,
  Users as UsersIcon,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return parts[0]![0]! + parts[parts.length - 1]![0]!;
}

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

interface Search {
  q?: string;
  page?: string;
  status?: 'all' | 'active' | 'inactive';
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const statusFilter: 'all' | 'active' | 'inactive' =
    sp.status === 'active' || sp.status === 'inactive' ? sp.status : 'all';

  const [customersRes, contractsCountRes, openMaintenanceRes] = await Promise.all([
    safe(
      api.get<Paged<User>>(
        `/users?role=CUSTOMER&page=${page}&pageSize=${PAGE_SIZE}`,
      ),
    ),
    safe(api.get<Paged<unknown>>('/contracts?pageSize=1')),
    safe(api.get<Paged<unknown>>('/maintenance-requests?status=OPEN&pageSize=1')),
  ]);

  let rows = customersRes.data?.data ?? [];

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(needle) ||
        u.email?.toLowerCase().includes(needle) ||
        u.phone?.toLowerCase().includes(needle),
    );
  }
  if (statusFilter === 'active') {
    rows = rows.filter((u) => u.active);
  } else if (statusFilter === 'inactive') {
    rows = rows.filter((u) => !u.active);
  }

  const totalCustomers = customersRes.data?.meta.total ?? rows.length;
  const totalContracts = contractsCountRes.data?.meta.total ?? 0;
  const openMaintenance = openMaintenanceRes.data?.meta.total ?? 0;

  const activeOnPage = rows.filter((u) => u.active).length;

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : '';
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="العملاء"
        description="عملاء أبرموا عقوداً ويملكون وحدات داخل المحفظة — متابعة ما بعد الشراء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء' },
        ]}
        actions={
          <>
            <IconButton label="تصدير" variant="outline" size="md">
              <Download />
            </IconButton>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي العملاء"
          value={totalCustomers}
          sub="عملاء بعد الشراء"
          icon={<UserCheck />}
          tone="success"
        />
        <PageKpiCard
          label="إجمالي العقود"
          value={totalContracts}
          sub="عقود مسجّلة"
          icon={<FileText />}
          tone="brand"
        />
        <PageKpiCard
          label="طلبات صيانة مفتوحة"
          value={openMaintenance}
          sub="بانتظار المعالجة"
          icon={<Wrench />}
          tone="warning"
        />
        <PageKpiCard
          label="نشطون (في هذه الصفحة)"
          value={activeOnPage}
          sub={`من ${rows.length} ظاهر`}
          icon={<ShieldCheck />}
          tone="info"
        />
      </div>

      {customersRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل القائمة: {customersRes.error}</p>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="inline-flex items-center gap-1 rounded-2xl bg-surface-muted p-1 ring-1 ring-inset ring-hairline">
        <StatusTab
          href={`/dashboard/customers${qs({ status: undefined })}`}
          active={statusFilter === 'all'}
          label="الكل"
        />
        <StatusTab
          href={`/dashboard/customers${qs({ status: 'active' })}`}
          active={statusFilter === 'active'}
          label="نشطون"
        />
        <StatusTab
          href={`/dashboard/customers${qs({ status: 'inactive' })}`}
          active={statusFilter === 'inactive'}
          label="موقوفون"
        />
      </div>

      {/* Search bar */}
      <form
        method="get"
        action="/dashboard/customers"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-white px-3 py-2.5 shadow-soft"
      >
        {statusFilter !== 'all' && (
          <input type="hidden" name="status" value={statusFilter} />
        )}
        <div className="flex-1 min-w-[180px]">
          <Input
            name="q"
            inputSize="sm"
            defaultValue={q}
            placeholder="ابحث بالاسم، البريد، أو الهاتف…"
            leftAddon={<Search />}
          />
        </div>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">بحث</Button>
          {q && (
            <Link href={`/dashboard/customers${qs({ q: undefined })}` as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-xs font-medium text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">بيانات الاتصال</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ التسجيل</th>
                <th className="text-start font-semibold py-3 px-4">آخر دخول</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<UserCheck />}
                      title={q ? 'لا توجد نتائج' : 'لا يوجد عملاء بعد'}
                      description={
                        q
                          ? 'جرّب تعديل كلمات البحث أو إزالة الفلاتر.'
                          : 'يتم ترقية العميل المتصفّح إلى عميل تلقائياً عند توقيع أول عقد.'
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className="group border-t border-hairline hover:bg-brand-50/20 transition-colors"
                >
                  <td className="py-3 ps-5 pe-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase shrink-0 ring-1 ring-inset ring-white shadow-sm',
                          paletteFor(u.fullName ?? u.email ?? u.id),
                        )}
                        aria-hidden
                      >
                        {initials(u.fullName ?? u.email ?? '·')}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/customers/${u.id}` as never}
                          className="font-semibold text-[13px] text-slate-900 hover:text-brand-700 group-hover:underline underline-offset-2 decoration-brand-300/50 transition-colors truncate block"
                        >
                          {u.fullName ?? '—'}
                        </Link>
                        <p className="text-2xs text-slate-400 mt-0.5 font-mono">
                          ID: #{u.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 min-w-[190px]">
                    <div className="flex flex-col gap-1.5">
                      {u.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`tel:${u.phone}`}
                            className="font-mono text-xs text-slate-700 hover:text-brand-700 transition-colors"
                            dir="ltr"
                          >
                            {u.phone}
                          </a>
                        </div>
                      ) : null}
                      {u.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`mailto:${u.email}`}
                            className="text-xs text-slate-600 hover:text-brand-700 transition-colors truncate max-w-[200px]"
                            dir="ltr"
                          >
                            {u.email}
                          </a>
                        </div>
                      ) : null}
                      {!u.phone && !u.email && (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {u.active ? (
                      <Badge tone="success" variant="soft" size="sm" dot>
                        نشط
                      </Badge>
                    ) : (
                      <Badge tone="gray" variant="soft" size="sm" dot>
                        موقوف
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/contracts?customerId=${u.id}` as never}
                      >
                        <IconButton label="عقود العميل" variant="outline" size="sm">
                          <FileText />
                        </IconButton>
                      </Link>
                      <Link
                        href={`/dashboard/maintenance?customerId=${u.id}` as never}
                      >
                        <IconButton label="طلبات الصيانة" variant="outline" size="sm">
                          <Wrench />
                        </IconButton>
                      </Link>
                      <Link href={`/dashboard/customers/${u.id}` as never}>
                        <IconButton label="عرض تفاصيل العميل" variant="outline" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customersRes.data && totalCustomers > PAGE_SIZE && !q && (
          <Pagination
            page={customersRes.data.meta.page}
            pageSize={customersRes.data.meta.pageSize}
            total={totalCustomers}
            basePath="/dashboard/customers"
            params={statusFilter !== 'all' ? { status: statusFilter } : {}}
          />
        )}
      </Card>

      <div className="flex items-start gap-2.5 rounded-2xl border border-info-100 bg-info-50/60 px-4 py-3 text-xs text-info-700">
        <Info className="h-4 w-4 shrink-0 mt-px text-info-500" />
        <p>
          هذه الصفحة تعرض العملاء المالكين فقط (بعد توقيع العقد). لإدارة العملاء المتصفّحين قبل الشراء انتقل إلى{' '}
          <Link
            href={'/dashboard/clients?role=CLIENT' as never}
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
          >
            <UsersIcon className="h-3 w-3" />
            صفحة المتصفّحين
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function StatusTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href as never}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors',
        active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-brand-200/50'
          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
      )}
    >
      {label}
    </Link>
  );
}
