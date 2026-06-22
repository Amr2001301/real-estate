import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { Plus, Users, UserCheck, UserX, Shield, Search } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, User, UserRole } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PremiumPageHero,
  PremiumSectionCard,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Server actions ────────────────────────────────────────────────────────────

async function deactivateAction(id: string) {
  'use server';
  await api.patch(`/users/${id}/deactivate`);
  revalidatePath('/dashboard/users');
}

async function activateAction(id: string) {
  'use server';
  await api.patch(`/users/${id}/activate`);
  revalidatePath('/dashboard/users');
}

async function createUserAction(formData: FormData) {
  'use server';
  await api.post('/users', {
    role:     String(formData.get('role')     ?? 'SALES'),
    fullName: String(formData.get('fullName') ?? ''),
    email:    String(formData.get('email')    ?? '') || undefined,
    phone:    String(formData.get('phone')    ?? '') || undefined,
    password: String(formData.get('password') ?? '') || undefined,
  });
  revalidatePath('/dashboard/users');
}

// ADMIN-only: assign/clear the SALES_MANAGER who owns a SALES rep.
async function assignManagerAction(userId: string, formData: FormData) {
  'use server';
  const managerId = String(formData.get('managerId') ?? '') || null;
  await api.patch(`/users/${userId}/manager`, { managerId });
  revalidatePath('/dashboard/users');
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CREATABLE_ROLES: { value: string; label: string }[] = [
  { value: 'ADMIN',                  label: 'مدير النظام' },
  { value: 'SALES',                  label: 'مبيعات' },
  { value: 'SALES_MANAGER',          label: 'مدير مبيعات' },
  { value: 'MAINTENANCE_SUPERVISOR', label: 'مشرف الصيانة' },
];

const FILTERABLE_ROLES: UserRole[] = [
  'ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'CLIENT', 'CUSTOMER',
];

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:                  'مدير النظام',
  SALES:                  'مبيعات',
  SALES_MANAGER:          'مدير مبيعات',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
  CLIENT:                 'متصفّح',
  CUSTOMER:               'عميل',
  BROKER:                 'وسيط',
};

const ROLE_BADGE_CLS: Record<UserRole, string> = {
  ADMIN:                  'bg-purple-100 text-purple-700',
  SALES_MANAGER:          'bg-blue-100 text-blue-700',
  SALES:                  'bg-brand-100 text-brand-700',
  MAINTENANCE_SUPERVISOR: 'bg-orange-100 text-orange-700',
  CLIENT:                 'bg-slate-100 text-slate-600',
  CUSTOMER:               'bg-teal-100 text-teal-700',
  BROKER:                 'bg-indigo-100 text-indigo-700',
};

const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100    text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100  text-amber-700',
  'bg-pink-100   text-pink-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length] ?? 'bg-slate-100 text-slate-700';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Search {
  role?: string;
  q?: string;
  status?: string;
  showCreate?: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const qs = new URLSearchParams({ pageSize: '100' });
  if (sp.role) qs.set('role', sp.role);

  const [usersRes, managersRes] = await Promise.all([
    safe(api.get<Paged<User>>(`/users?${qs}`)),
    safe(api.get<Paged<User>>('/users?role=SALES_MANAGER&pageSize=100')),
  ]);

  const allUsers = usersRes.data?.data ?? [];
  const managers = managersRes.data?.data ?? [];

  // Client-side text + status filter (all rows are already fetched)
  const q      = sp.q?.trim().toLowerCase() ?? '';
  const status = sp.status ?? '';

  const rows = allUsers.filter((u) => {
    if (q) {
      const hay = `${u.fullName} ${u.email ?? ''} ${u.phone ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status === 'active'   && !u.active) return false;
    if (status === 'inactive' &&  u.active) return false;
    return true;
  });

  // KPI metrics — computed from unfiltered set
  const total    = allUsers.length;
  const active   = allUsers.filter((u) => u.active).length;
  const inactive = total - active;
  const adminRoles = allUsers.filter(
    (u) => u.role === 'ADMIN' || u.role === 'SALES_MANAGER',
  ).length;
  const lastLogin = allUsers
    .map((u) => u.lastLoginAt)
    .filter(Boolean)
    .sort()
    .pop();

  const showCreate = sp.showCreate === '1';
  const hasFilter  = !!(sp.q || sp.role || sp.status);

  // URL builders
  const showCreateUrl = (() => {
    const p = new URLSearchParams();
    if (sp.role)   p.set('role',   sp.role);
    if (sp.q)      p.set('q',      sp.q);
    if (sp.status) p.set('status', sp.status);
    p.set('showCreate', '1');
    return `/dashboard/users?${p.toString()}`;
  })();

  const cancelCreateUrl = (() => {
    const p = new URLSearchParams();
    if (sp.role)   p.set('role',   sp.role);
    if (sp.q)      p.set('q',      sp.q);
    if (sp.status) p.set('status', sp.status);
    const s = p.toString();
    return `/dashboard/users${s ? `?${s}` : ''}`;
  })();

  const clearFilterUrl = `/dashboard/users${showCreate ? '?showCreate=1' : ''}`;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="المستخدمون"
        description="إدارة حسابات المستخدمين، الأدوار، حالة التفعيل، وربط فرق المبيعات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المستخدمون' },
        ]}
        actions={
          !showCreate ? (
            <Link href={showCreateUrl as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة مستخدم
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── KPI summary strip ───────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: 'إجمالي المستخدمين', value: total, icon: <Users />, tone: 'info' },
          { label: 'المستخدمون النشطون', value: active, icon: <UserCheck />, tone: 'success' },
          { label: 'معطلون', value: inactive, icon: <UserX />, tone: 'neutral' },
          {
            label: 'أدوار إدارية',
            value: adminRoles,
            sub: lastLogin ? `آخر دخول: ${formatDate(lastLogin)}` : undefined,
            icon: <Shield />,
            tone: 'brand',
          },
        ]}
      />

      {/* ── Create user (collapsible via showCreate=1) ──────────────────── */}
      {showCreate && (
        <PremiumSectionCard
          title="إضافة مستخدم جديد"
          trailing={
            <Link
              href={cancelCreateUrl as never}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              إلغاء
            </Link>
          }
        >
          <form
            action={createUserAction}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">الدور</label>
              <Select name="role" inputSize="sm" defaultValue="SALES">
                {CREATABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">الاسم الكامل</label>
              <Input
                name="fullName"
                inputSize="sm"
                required
                placeholder="الاسم الكامل"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">البريد الإلكتروني</label>
              <Input
                name="email"
                type="email"
                inputSize="sm"
                required
                placeholder="user@example.com"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">كلمة مرور مؤقتة</label>
              <Input
                name="password"
                type="password"
                inputSize="sm"
                required
                minLength={8}
                placeholder="٨ أحرف على الأقل"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" size="sm" fullWidth>
                إنشاء الحساب
              </Button>
            </div>
          </form>
        </PremiumSectionCard>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/users"
        trailing={
          <>
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilter && (
              <Link href={clearFilterUrl as never}>
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </>
        }
      >
        {showCreate && <input type="hidden" name="showCreate" value="1" />}
        <PremiumFilterField label="بحث">
          <div className="w-60">
            <Input
              name="q"
              inputSize="sm"
              placeholder="بحث باسم أو بريد أو هاتف…"
              defaultValue={sp.q ?? ''}
              leftAddon={<Search />}
            />
          </div>
        </PremiumFilterField>
        <PremiumFilterField label="الدور">
          <Select
            name="role"
            inputSize="sm"
            defaultValue={sp.role ?? ''}
            className="w-40"
          >
            <option value="">كل الأدوار</option>
            {FILTERABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label="الحالة">
          <Select
            name="status"
            inputSize="sm"
            defaultValue={sp.status ?? ''}
            className="w-36"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط فقط</option>
            <option value="inactive">معطل فقط</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {usersRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {usersRes.error}
        </div>
      )}

      {/* ── Users table ─────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<Users />}
        title="قائمة المستخدمين"
        description={`${rows.length} مستخدم`}
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={hasFilter ? 'لا توجد نتائج مطابقة' : 'لا يوجد مستخدمون بعد'}
            description={
              hasFilter
                ? 'جرّب تعديل معايير البحث أو مسح الفلاتر.'
                : 'ابدأ بإضافة أول مستخدم من خلال زر "إضافة مستخدم".'
            }
            action={
              hasFilter ? (
                <Link href={clearFilterUrl as never}>
                  <Button variant="outline" size="sm">مسح الفلاتر</Button>
                </Link>
              ) : (
                <Link href={showCreateUrl as never}>
                  <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                    إضافة مستخدم
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-xs text-slate-500 border-b border-hairline">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4 whitespace-nowrap">المستخدم</th>
                  <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">الدور</th>
                  <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">التواصل</th>
                  <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">مدير المبيعات</th>
                  <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">انضم</th>
                  <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">آخر دخول</th>
                  <th className="text-start font-semibold py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="group border-t border-hairline hover:bg-brand-50/20 transition-colors align-middle"
                  >
                    {/* ── User ────────────────────────────────────── */}
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                            avatarColor(u.id),
                          )}
                          aria-hidden
                        >
                          {initials(u.fullName)}
                        </span>
                        <span className="font-medium text-slate-800 leading-tight truncate">
                          {u.fullName}
                        </span>
                      </div>
                    </td>

                    {/* ── Role ────────────────────────────────────── */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight whitespace-nowrap',
                          ROLE_BADGE_CLS[u.role] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>

                    {/* ── Contact ─────────────────────────────────── */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-xs text-slate-500 font-mono" dir="ltr">
                        {u.email || u.phone || '—'}
                      </span>
                    </td>

                    {/* ── Sales manager ───────────────────────────── */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {u.role === 'SALES' ? (
                        <form
                          action={assignManagerAction.bind(null, u.id)}
                          className="flex items-center gap-1.5"
                        >
                          <Select
                            name="managerId"
                            defaultValue={u.managerId ?? ''}
                            inputSize="sm"
                            className="w-40"
                          >
                            <option value="">بدون مدير</option>
                            {managers.map((m) => (
                              <option key={m.id} value={m.id}>{m.fullName}</option>
                            ))}
                          </Select>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-lg border border-hairline bg-surface text-slate-700 shadow-xs hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors shrink-0"
                          >
                            حفظ
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* ── Joined ──────────────────────────────────── */}
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDate(u.createdAt)}
                    </td>

                    {/* ── Last login ──────────────────────────────── */}
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* ── Status badge ────────────────────────────── */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 text-success-700 px-2.5 py-0.5 text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-success-500 shrink-0" aria-hidden />
                          نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden />
                          معطل
                        </span>
                      )}
                    </td>

                    {/* ── Action ──────────────────────────────────── */}
                    <td className="py-3 ps-4 pe-5">
                      {u.active ? (
                        <form action={deactivateAction.bind(null, u.id)}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                          >
                            تعطيل
                          </Button>
                        </form>
                      ) : (
                        <form action={activateAction.bind(null, u.id)}>
                          <Button type="submit" variant="outline" size="sm">
                            تفعيل
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>
    </div>
  );
}
