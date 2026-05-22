import Link from 'next/link';
import { ShieldCheck, Search as SearchIcon, Users as UsersIcon, Info } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PermissionItem, Paged, User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import {
  getPermissionMeta,
  PERMISSION_CATEGORIES,
  PERMISSION_TYPE_CLS,
  type PermissionCategory,
  type PermissionMeta,
} from '@/lib/permission-labels';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  q?: string;
}

type EnrichedPermission = PermissionItem & { meta: PermissionMeta };

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [permsRes, usersRes] = await Promise.all([
    safe(api.get<PermissionItem[]>('/permissions')),
    safe(api.get<Paged<User>>('/users?pageSize=50')),
  ]);

  // Enrich each permission with business-friendly display metadata.
  const all: EnrichedPermission[] = (permsRes.data ?? []).map((p) => ({
    ...p,
    meta: getPermissionMeta(p.code, p.description),
  }));

  // Search matches code, Arabic label, description, and category.
  const needle = sp.q?.trim().toLowerCase();
  const filtered = needle
    ? all.filter((p) =>
        [p.code, p.meta.label, p.meta.description, p.meta.category]
          .some((field) => field.toLowerCase().includes(needle)),
      )
    : all;

  // Group by business category, in the canonical display order.
  const byCategory = new Map<PermissionCategory, EnrichedPermission[]>();
  for (const p of filtered) {
    const list = byCategory.get(p.meta.category) ?? [];
    list.push(p);
    byCategory.set(p.meta.category, list);
  }
  const sections = PERMISSION_CATEGORIES.map((cat) => ({
    category: cat,
    items: (byCategory.get(cat) ?? []).slice().sort((a, b) => a.meta.label.localeCompare(b.meta.label, 'ar')),
  })).filter((s) => s.items.length > 0);

  const users = usersRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصلاحيات"
        description="الصلاحيات مكتوبة بلغة العمل ومجمّعة حسب القسم. الأكواد التقنية تظهر للمراجعة فقط."
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

      <div className="rounded-2xl bg-info-50 border border-info-100 text-info-800 p-4 text-sm flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          الصلاحيات تتحكم في ما يمكن للمستخدم عرضه أو تنفيذه. الأكواد التقنية تظهر للمراجعة فقط، لكن أسماء الصلاحيات هنا مكتوبة بلغة العمل.
        </p>
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
              placeholder="بحث بالاسم أو الوصف أو القسم أو الرمز (مثل: حجز، دفعة، عمولة، audit)"
              defaultValue={sp.q ?? ''}
              className="flex-1 min-w-[240px]"
            />
            <div className="flex items-center gap-1.5">
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

          {sections.length === 0 ? (
            <Card className="overflow-hidden">
              <EmptyState
                icon={<ShieldCheck />}
                title="لا توجد صلاحيات مطابقة"
                description="جرّب توسيع البحث أو تأكّد من بذر رموز الصلاحيات في النظام."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <Card key={section.category} className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-2.5 border-b border-hairline bg-surface-muted/40">
                    <h2 className="text-sm font-semibold text-slate-800">{section.category}</h2>
                    <span className="text-2xs text-slate-400 tabular-nums">{section.items.length}</span>
                  </div>
                  <ul className="divide-y divide-hairline">
                    {section.items.map((p) => (
                      <li key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-900">{p.meta.label}</span>
                            <span
                              className={cn(
                                'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium leading-tight',
                                PERMISSION_TYPE_CLS[p.meta.type],
                              )}
                            >
                              {p.meta.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{p.meta.description}</p>
                          <p className="font-mono text-2xs text-slate-400 mt-1" dir="ltr">{p.code}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700 shrink-0">
                          <UsersIcon className="h-3 w-3" />
                          {p.userCount} مستخدم
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="p-5 self-start">
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
