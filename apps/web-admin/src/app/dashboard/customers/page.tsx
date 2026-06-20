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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
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

interface Filters {
  q?: string;
  page?: string;
  status?: 'all' | 'active' | 'inactive';
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
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

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="المتصفحون"
        description="متابعة زوار المنصة وتحويلهم إلى فرص وعملاء محتملين."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المتصفحون' },
        ]}
        actions={
          <IconButton label="تصدير" variant="outline" size="md">
            <Download />
          </IconButton>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        cols={4}
        metrics={[
          {
            label: 'إجمالي العملاء',
            value: totalCustomers,
            icon: <UserCheck />,
            tone: 'success',
            primary: true,
            sub: 'عملاء بعد الشراء',
          },
          {
            label: 'إجمالي العقود',
            value: totalContracts,
            icon: <FileText />,
            tone: 'brand',
            sub: 'عقود مسجّلة',
          },
          {
            label: 'طلبات صيانة مفتوحة',
            value: openMaintenance,
            icon: <Wrench />,
            tone: 'warning',
            sub: 'بانتظار المعالجة',
          },
          {
            label: 'نشطون (في هذه الصفحة)',
            value: activeOnPage,
            icon: <ShieldCheck />,
            tone: 'info',
            sub: `من ${rows.length} ظاهر`,
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {customersRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل القائمة: {customersRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/customers">
        <PremiumFilterField label="الحالة" htmlFor="cus-status">
          <Select id="cus-status" name="status" inputSize="sm" defaultValue={statusFilter} className="w-36 shrink-0">
            <option value="all">الكل</option>
            <option value="active">نشطون</option>
            <option value="inactive">موقوفون</option>
          </Select>
        </PremiumFilterField>

        <div className="flex-1 min-w-[180px]">
          <label htmlFor="cus-q" className="sr-only">بحث</label>
          <Input
            id="cus-q"
            name="q"
            inputSize="sm"
            defaultValue={q}
            placeholder="ابحث بالاسم، البريد، أو الهاتف…"
            leftAddon={<Search />}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="submit" variant="primary" size="sm">بحث</Button>
          {(q || statusFilter !== 'all') && (
            <Link href={'/dashboard/customers' as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Customers table ──────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<UserCheck />}
        title="قائمة العملاء المالكين"
        description="عملاء أبرموا عقوداً ويملكون وحدات داخل المحفظة."
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {totalCustomers.toLocaleString('ar-EG')} عميل
          </span>
        }
      >
        {rows.length === 0 ? (
          <PremiumEmptyState
            icon={<UserCheck />}
            title={q ? 'لا توجد نتائج' : 'لا يوجد عملاء بعد'}
            description={
              q
                ? 'جرّب تعديل كلمات البحث أو إزالة الفلاتر.'
                : 'يتم ترقية العميل المتصفّح إلى عميل تلقائياً عند توقيع أول عقد.'
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">العميل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">بيانات الاتصال</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ التسجيل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">آخر دخول</th>
                  <th className="text-start py-3 ps-4 pe-5 whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((u) => (
                  <tr key={u.id} className="group hover:bg-canvas/40 transition-colors duration-100">
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
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/contracts?customerId=${u.id}` as never}>
                          <IconButton label="عقود العميل" variant="outline" size="sm">
                            <FileText />
                          </IconButton>
                        </Link>
                        <Link href={`/dashboard/maintenance?customerId=${u.id}` as never}>
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
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {customersRes.data && totalCustomers > PAGE_SIZE && !q && (
        <Pagination
          page={customersRes.data.meta.page}
          pageSize={customersRes.data.meta.pageSize}
          total={totalCustomers}
          basePath="/dashboard/customers"
          params={statusFilter !== 'all' ? { status: statusFilter } : {}}
        />
      )}

      {/* ── Info note ────────────────────────────────────────────────────────── */}
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
