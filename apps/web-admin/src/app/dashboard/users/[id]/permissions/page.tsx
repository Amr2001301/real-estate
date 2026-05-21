import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UserPermissionsResponse } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionPicker } from './permission-picker';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await safe(api.get<UserPermissionsResponse>(`/users/${id}/permissions`));
  if (res.error || !res.data) notFound();
  const { user, assigned, available } = res.data;

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

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">الصلاحيات</h2>
        <PermissionPicker
          userId={id}
          userName={user.fullName}
          assigned={assigned}
          available={available}
        />
      </Card>
    </div>
  );
}
