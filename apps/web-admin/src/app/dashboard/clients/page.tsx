import Link from 'next/link';
import {
  Users,
  UserCheck,
  AlertCircle,
  Phone,
  Mail,
  Plus,
  Download,
  Search,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
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

const ROLE_LABEL: Record<'CLIENT' | 'CUSTOMER', { title: string; description: string }> = {
  CLIENT: {
    title: 'العملاء (متصفّحون)',
    description: 'مستخدمون مسجّلون يتصفحون المشاريع والوحدات.',
  },
  CUSTOMER: {
    title: 'العملاء (مالكون)',
    description: 'عملاء أبرموا عقوداً ويملكون وحدات داخل المحفظة.',
  },
};

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

const PAGE_SIZE = 20;

interface Search {
  role?: string;
  q?: string;
  page?: string;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const role: 'CLIENT' | 'CUSTOMER' = sp.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const [currentRes, clientCountRes, customerCountRes] = await Promise.all([
    safe(
      api.get<Paged<User>>(
        `/users?role=${role}&page=${page}&pageSize=${PAGE_SIZE}`,
      ),
    ),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=1')),
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=1')),
  ]);

  let rows = currentRes.data?.data ?? [];
  // Client-side text filter (API doesn't support q on /users)
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(needle) ||
        u.email?.toLowerCase().includes(needle) ||
        u.phone?.toLowerCase().includes(needle),
    );
  }
  const total = currentRes.data?.meta.total ?? rows.length;
  const clientTotal = clientCountRes.data?.meta.total ?? 0;
  const customerTotal = customerCountRes.data?.meta.total ?? 0;

  // KPI quick stats from current page (best-effort, no extra round-trip)
  const activeOnPage = rows.filter((u) => u.active).length;
  const inactiveOnPage = rows.length - activeOnPage;

  const labels = ROLE_LABEL[role];

  return (
    <div className="space-y-5">
      <PageHeader
        title={labels.title}
        description={labels.description}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء' },
        ]}
        actions={
          <>
            <IconButton label="تصدير" variant="outline" size="md">
              <Download />
            </IconButton>
            <Link href={`/dashboard/clients/new?role=${role}` as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة عميل جديد
              </Button>
            </Link>
          </>
        }
      />

      {/* Role tabs */}
      <div className="inline-flex items-center gap-1 rounded-2xl bg-surface-muted p-1 ring-1 ring-inset ring-hairline">
        <RoleTab
          href={`/dashboard/clients?role=CLIENT${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          active={role === 'CLIENT'}
          icon={<Users className="h-4 w-4" />}
          label="متصفّحون"
          count={clientTotal}
        />
        <RoleTab
          href={`/dashboard/clients?role=CUSTOMER${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          active={role === 'CUSTOMER'}
          icon={<UserCheck className="h-4 w-4" />}
          label="مالكون"
          count={customerTotal}
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي العملاء"
          value={clientTotal + customerTotal}
          sub="بكل أنواعهم"
          icon={<Users />}
          tone="brand"
        />
        <PageKpiCard
          label="عملاء متصفّحون"
          value={clientTotal}
          icon={<Users />}
          tone="info"
        />
        <PageKpiCard
          label="مالكون"
          value={customerTotal}
          icon={<UserCheck />}
          tone="success"
        />
        <PageKpiCard
          label="موقوفون (في هذه الصفحة)"
          value={inactiveOnPage}
          sub={`من ${rows.length} ظاهر`}
          icon={<ShieldAlert />}
          tone="warning"
        />
      </div>

      {currentRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل القائمة: {currentRes.error}</p>
        </div>
      )}

      {/* Search bar */}
      <form
        method="get"
        action="/dashboard/clients"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <input type="hidden" name="role" value={role} />
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
            <Link href={`/dashboard/clients?role=${role}` as never}>
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
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">بيانات الاتصال</th>
                <th className="text-start font-semibold py-3 px-4">النوع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ التسجيل</th>
                <th className="text-start font-semibold py-3 px-4">آخر دخول</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={role === 'CUSTOMER' ? <UserCheck /> : <Users />}
                      title={
                        q
                          ? 'لا توجد نتائج'
                          : role === 'CUSTOMER'
                            ? 'لا يوجد مالكون بعد'
                            : 'لا يوجد عملاء متصفّحون بعد'
                      }
                      description={
                        q
                          ? 'جرّب تعديل كلمات البحث أو تغيير التبويب.'
                          : role === 'CUSTOMER'
                            ? 'يتم ترقية العميل إلى مالك تلقائياً عند توقيع عقد.'
                            : 'يظهر هنا كل من يسجّل في المنصة من المتصفحين.'
                      }
                      action={
                        !q ? (
                          <Link
                            href={`/dashboard/clients/new?role=${role}` as never}
                          >
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Plus className="h-4 w-4" />}
                            >
                              إضافة عميل
                            </Button>
                          </Link>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
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
                          href={`/dashboard/clients/${u.id}` as never}
                          className="font-semibold text-slate-900 hover:text-brand-700 transition-colors truncate block"
                        >
                          {u.fullName ?? '—'}
                        </Link>
                        <p className="text-2xs text-slate-400 mt-0.5 font-mono">
                          ID: #{u.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      {u.phone ? (
                        <a
                          href={`tel:${u.phone}`}
                          className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 font-mono text-xs"
                          dir="ltr"
                        >
                          <Phone className="h-3 w-3 text-slate-400" />
                          {u.phone}
                        </a>
                      ) : null}
                      {u.email ? (
                        <a
                          href={`mailto:${u.email}`}
                          className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 text-xs"
                          dir="ltr"
                        >
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[220px]">{u.email}</span>
                        </a>
                      ) : null}
                      {!u.phone && !u.email && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      tone={role === 'CUSTOMER' ? 'success' : 'info'}
                      variant="soft"
                      size="sm"
                    >
                      {role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                    </Badge>
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
                    <Link href={`/dashboard/clients/${u.id}` as never}>
                      <IconButton label="عرض الملف" variant="ghost" size="sm">
                        <ArrowRight className="rtl:rotate-180" />
                      </IconButton>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentRes.data && total > PAGE_SIZE && !q && (
          <Pagination
            page={currentRes.data.meta.page}
            pageSize={currentRes.data.meta.pageSize}
            total={total}
            basePath="/dashboard/clients"
            params={{ role }}
          />
        )}
      </Card>

      {/* Footer hint about activity */}
      <p className="flex items-center justify-center gap-1.5 text-2xs text-slate-400">
        <ShieldCheck className="h-3 w-3" />
        تتبع جميع التغييرات على ملفات العملاء عبر سجل التدقيق المركزي.
      </p>
    </div>
  );
}

function RoleTab({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href as never}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors',
        active
          ? 'bg-surface text-slate-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-surface',
      )}
    >
      <span className={cn(active ? 'text-brand-600' : 'text-slate-400')}>{icon}</span>
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md text-2xs font-bold',
          active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600',
        )}
      >
        {count}
      </span>
    </Link>
  );
}
