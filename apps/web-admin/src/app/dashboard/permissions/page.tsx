import Link from 'next/link';
import { ShieldCheck, Search as SearchIcon, Users as UsersIcon } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PermissionItem, Paged, User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  q?: string;
}

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [permsRes, usersRes] = await Promise.all([
    safe(api.get<PermissionItem[]>('/permissions')),
    // Pull a generous slice of users for the "manage a user" quick-link;
    // the dedicated user-permissions page does its own search.
    safe(api.get<Paged<User>>('/users?pageSize=50')),
  ]);

  const all = permsRes.data ?? [];
  const filtered = sp.q
    ? all.filter((p) => {
        const needle = sp.q!.toLowerCase();
        return (
          p.code.toLowerCase().includes(needle) ||
          (p.description ?? '').toLowerCase().includes(needle)
        );
      })
    : all;
  const users = usersRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصلاحيات"
        description="رموز الصلاحيات الموجودة في النظام وعدد المستخدمين المنسوبين لكل صلاحية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصلاحيات' },
        ]}
        meta={<ShieldCheck className="h-4 w-4 text-brand-600" />}
      />

      {permsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الصلاحيات: {permsRes.error}
        </div>
      )}

      <div className="rounded-2xl bg-info-50 border border-info-100 text-info-800 p-4 text-sm">
        الصلاحيات التفصيلية محفوظة في النظام، وقد لا تكون مفعّلة على كل المسارات بعد. الأدوار الأساسية (ADMIN/SALES/BROKER) ما زالت تتحكم في الوصول الأساسي. راجع تقرير المرحلة 16 لتفاصيل التطبيق.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <form
            method="get"
            action="/dashboard/permissions"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white p-3 shadow-xs"
          >
            <Input
              name="q"
              inputSize="sm"
              placeholder="بحث بالرمز أو الوصف"
              defaultValue={sp.q ?? ''}
              className="w-64"
              dir="ltr"
            />
            <div className="flex items-center gap-1.5 ms-auto">
              <Button type="submit" variant="primary" size="sm" leftIcon={<SearchIcon className="h-3.5 w-3.5" />}>
                بحث
              </Button>
              {sp.q && (
                <Link href="/dashboard/permissions">
                  <Button type="button" variant="ghost" size="sm">مسح</Button>
                </Link>
              )}
            </div>
          </form>

          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck />}
                title="لا توجد صلاحيات مطابقة"
                description="جرّب توسيع البحث أو تأكّد من بذر رموز الصلاحيات في النظام."
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {filtered.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-slate-900" dir="ltr">{p.code}</p>
                      {p.description && (
                        <p className="text-xs text-slate-600 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700 shrink-0">
                      <UsersIcon className="h-3 w-3" />
                      {p.userCount} مستخدم
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">إدارة صلاحيات مستخدم</h2>
          <p className="text-2xs text-slate-500 mb-3">
            اختر مستخدمًا لإدارة الصلاحيات المسندة إليه. سيُكتب التغيير في سجل التدقيق.
          </p>
          {users.length === 0 ? (
            <p className="text-xs text-slate-500">لا يوجد مستخدمون.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {users.map((u) => (
                <li key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.fullName}</p>
                    <p className="text-2xs text-slate-500 mt-0.5 font-mono" dir="ltr">{u.role}</p>
                  </div>
                  <Link href={`/dashboard/users/${u.id}/permissions`}>
                    <Button variant="ghost" size="sm">إدارة</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
