import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ShieldCheck, Plus, X } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UserPermissionsResponse } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmingForm } from '@/components/confirming-form';
import { grantPermissionAction, revokePermissionAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  ok?: string;
  err?: string;
}

export default async function UserPermissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const res = await safe(api.get<UserPermissionsResponse>(`/users/${id}/permissions`));
  if (res.error || !res.data) notFound();
  const { user, assigned, available } = res.data;

  // Bind the user id into the actions so the forms can stay declarative.
  const grant = grantPermissionAction.bind(null, id);
  const revoke = revokePermissionAction.bind(null, id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`صلاحيات: ${user.fullName}`}
        description="إدارة الصلاحيات التفصيلية لهذا المستخدم. لا تغيِّر هذه الصفحة الدور الأساسي."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصلاحيات', href: '/dashboard/permissions' },
          { label: user.fullName },
        ]}
        meta={
          <>
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <span className="font-mono text-xs text-slate-500" dir="ltr">{user.role}</span>
          </>
        }
        actions={
          <Link href="/dashboard/permissions">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للصلاحيات
            </Button>
          </Link>
        }
      />

      {sp.err && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && (
        <div className="rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
          تم تحديث صلاحيات المستخدم.
        </div>
      )}

      <div className="rounded-2xl bg-info-50 border border-info-100 text-info-800 p-4 text-sm">
        الصلاحيات التفصيلية محفوظة في النظام، وقد لا تكون مفعّلة على كل المسارات بعد. الأدوار الأساسية ما زالت تتحكم في الوصول الأساسي.
        تغيير هذه الصلاحيات لا يُعدِّل الدور الأساسي للمستخدم.
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">معلومات المستخدم</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-2xs text-slate-500">الاسم</dt>
            <dd className="font-medium text-slate-900">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-2xs text-slate-500">الدور</dt>
            <dd className="font-mono text-xs" dir="ltr">{user.role}</dd>
          </div>
          <div>
            <dt className="text-2xs text-slate-500">الحالة</dt>
            <dd>
              {user.active ? (
                <span className="text-xs text-success-700">نشط</span>
              ) : (
                <span className="text-xs text-slate-500">معطّل</span>
              )}
            </dd>
          </div>
          {user.email && (
            <div className="md:col-span-2">
              <dt className="text-2xs text-slate-500">البريد</dt>
              <dd className="text-xs" dir="ltr">{user.email}</dd>
            </div>
          )}
          {user.phone && (
            <div>
              <dt className="text-2xs text-slate-500">الجوال</dt>
              <dd className="text-xs" dir="ltr">{user.phone}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">الصلاحيات المسندة</h2>
          <span className="text-2xs text-slate-500">{assigned.length}</span>
        </div>
        {assigned.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck />}
            title="لا توجد صلاحيات مسندة"
            description="استخدم النموذج أدناه لإضافة صلاحية من القائمة المتاحة."
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {assigned.map((p) => (
              <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-900" dir="ltr">{p.code}</p>
                  {p.description && (
                    <p className="text-2xs text-slate-500 mt-0.5">{p.description}</p>
                  )}
                </div>
                <ConfirmingForm
                  action={revoke}
                  confirmMessage={`سيتم سحب صلاحية «${p.code}» من ${user.fullName}. هل أنت متأكد؟`}
                >
                  <input type="hidden" name="code" value={p.code} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    leftIcon={<X className="h-3.5 w-3.5" />}
                    className="text-danger-700 hover:text-danger-800 hover:bg-danger-50"
                  >
                    سحب
                  </Button>
                </ConfirmingForm>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">إضافة صلاحية</h2>
        {available.length === 0 ? (
          <p className="text-xs text-slate-500">جميع الصلاحيات المسجّلة في النظام مسندة بالفعل لهذا المستخدم.</p>
        ) : (
          <form action={grant} className="flex flex-wrap items-center gap-2">
            <Select name="code" defaultValue="" className="w-72" required>
              <option value="" disabled>اختر صلاحية…</option>
              {available.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code}{p.description ? ` — ${p.description}` : ''}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إضافة
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
