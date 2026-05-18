import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Star, Mail, Phone, UserPlus, ChevronLeft } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerUser, BrokerUserStatus } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/form/field';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerUserStatusBadge } from '@/components/badges';
import { ConfirmingForm } from '@/components/confirming-form';
import {
  updateBrokerUserAction,
  setBrokerUserPrimaryAction,
  updateBrokerUserStatusAction,
} from '../../actions';
import CreateBrokerUserForm from './_create-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function BrokerUsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [brokerRes, usersRes] = await Promise.all([
    safe(api.get<Broker>(`/brokers/${id}`)),
    safe(api.get<BrokerUser[]>(`/brokers/${id}/users`)),
  ]);
  if (brokerRes.error || !brokerRes.data) notFound();

  const broker = brokerRes.data;
  const users = usersRes.data ?? [];

  // Bind server actions to use them on the server inline.
  async function updateUser(brokerUserId: string, formData: FormData) {
    'use server';
    await updateBrokerUserAction(id, brokerUserId, formData);
  }
  async function makePrimary(brokerUserId: string) {
    'use server';
    await setBrokerUserPrimaryAction(id, brokerUserId);
  }
  async function changeStatus(brokerUserId: string, status: BrokerUserStatus) {
    'use server';
    await updateBrokerUserStatusAction(id, brokerUserId, status);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="موظفو الوسيط"
        description={`إدارة الحسابات المرتبطة بشركة ${broker.companyName}.`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: broker.companyName, href: `/dashboard/brokers/${id}` },
          { label: 'الموظفون' },
        ]}
        actions={
          <Link href={`/dashboard/brokers/${id}` as never}>
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للوسيط
            </Button>
          </Link>
        }
      />

      {usersRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل قائمة الموظفين: {usersRes.error}
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand-600" />
          إضافة موظف جديد
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          إذا كان لدى الشخص حساب بدور <span className="font-mono">BROKER</span> فسيتم
          ربطه بشركة الوساطة. لا يُسمح بتحويل أدوار أخرى تلقائياً.
        </p>
        <CreateBrokerUserForm brokerId={id} />
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الموظف</th>
                <th className="text-start font-semibold py-3 px-4">الوظيفة</th>
                <th className="text-start font-semibold py-3 px-4">التواصل</th>
                <th className="text-start font-semibold py-3 px-4">الصلاحيات</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">آخر دخول</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<UserPlus />}
                      title="لا يوجد موظفون بعد"
                      description="استخدم النموذج أعلاه لدعوة أول موظف لهذا الوسيط."
                    />
                  </td>
                </tr>
              )}
              {users.map((bu) => {
                const u = bu.user;
                return (
                  <tr
                    key={bu.id}
                    className="border-t border-hairline align-top hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-start gap-2">
                        {bu.isPrimaryContact && (
                          <Star
                            className="h-4 w-4 text-amber-500 fill-current shrink-0 mt-0.5"
                            aria-label="جهة الاتصال الرئيسية"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{u.fullName}</p>
                          {bu.isPrimaryContact && (
                            <p className="text-2xs text-amber-600 mt-0.5">
                              جهة الاتصال الرئيسية
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{bu.jobTitle || '—'}</td>
                    <td className="py-3 px-4 text-xs text-slate-700 space-y-1" dir="ltr">
                      {u.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {u.email}
                        </p>
                      )}
                      {u.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {u.phone}
                        </p>
                      )}
                      {!u.email && !u.phone && <p>—</p>}
                    </td>
                    <td className="py-3 px-4 text-2xs text-slate-600 space-y-0.5">
                      {bu.canManageBrokerUsers && <p>إدارة الموظفين</p>}
                      {bu.canViewCommissions && <p>عرض العمولات</p>}
                      {!bu.canManageBrokerUsers && !bu.canViewCommissions && <p>—</p>}
                    </td>
                    <td className="py-3 px-4">
                      <BrokerUserStatusBadge status={bu.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td className="py-3 ps-4 pe-5">
                      <div className="flex flex-col items-end gap-1.5">
                        {!bu.isPrimaryContact && bu.status !== 'REMOVED' && (
                          <form action={makePrimary.bind(null, bu.id)}>
                            <button
                              type="submit"
                              className="text-2xs text-amber-700 hover:underline"
                            >
                              تعيين رئيسي
                            </button>
                          </form>
                        )}
                        {bu.status !== 'ACTIVE' && bu.status !== 'REMOVED' && (
                          <form action={changeStatus.bind(null, bu.id, 'ACTIVE')}>
                            <button
                              type="submit"
                              className="text-2xs text-green-700 hover:underline"
                            >
                              تفعيل
                            </button>
                          </form>
                        )}
                        {bu.status === 'ACTIVE' && (
                          <form action={changeStatus.bind(null, bu.id, 'SUSPENDED')}>
                            <button
                              type="submit"
                              className="text-2xs text-amber-700 hover:underline"
                            >
                              إيقاف مؤقت
                            </button>
                          </form>
                        )}
                        {bu.status !== 'REMOVED' && (
                          <ConfirmingForm
                            action={changeStatus.bind(null, bu.id, 'REMOVED')}
                            confirmMessage={`سيتم حذف «${bu.user.fullName}» من قائمة موظفي الوسيط. هل أنت متأكد؟`}
                          >
                            <button
                              type="submit"
                              className="text-2xs text-red-600 hover:underline"
                            >
                              حذف
                            </button>
                          </ConfirmingForm>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {users.length > 0 && (
          <div className="border-t border-hairline p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              تعديل بيانات موظف
            </h3>
            {users.map((bu) => {
              const u = bu.user;
              return (
                <details
                  key={bu.id}
                  className="rounded-xl border border-hairline bg-surface p-3"
                >
                  <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-brand-700 flex items-center gap-2">
                    <span>تعديل: {u.fullName}</span>
                    <span className="font-mono text-2xs text-slate-400" dir="ltr">
                      {u.email ?? u.phone ?? '—'}
                    </span>
                  </summary>
                  <form
                    action={updateUser.bind(null, bu.id)}
                    className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    <Field label="الاسم الكامل" name={`fullName-${bu.id}`}>
                      <Input
                        id={`fullName-${bu.id}`}
                        name="fullName"
                        defaultValue={u.fullName}
                      />
                    </Field>
                    <Field label="الوظيفة" name={`jobTitle-${bu.id}`}>
                      <Input
                        id={`jobTitle-${bu.id}`}
                        name="jobTitle"
                        defaultValue={bu.jobTitle ?? ''}
                      />
                    </Field>
                    <Field label="البريد الإلكتروني" name={`email-${bu.id}`}>
                      <Input
                        id={`email-${bu.id}`}
                        name="email"
                        type="email"
                        dir="ltr"
                        defaultValue={u.email ?? ''}
                      />
                    </Field>
                    <Field label="رقم الجوال" name={`phone-${bu.id}`}>
                      <Input
                        id={`phone-${bu.id}`}
                        name="phone"
                        dir="ltr"
                        defaultValue={u.phone ?? ''}
                      />
                    </Field>
                    <div className="md:col-span-2 flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox
                          name="canManageBrokerUsers"
                          defaultChecked={bu.canManageBrokerUsers}
                        />
                        <span>صلاحية إدارة الموظفين</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox
                          name="canViewCommissions"
                          defaultChecked={bu.canViewCommissions}
                        />
                        <span>عرض العمولات</span>
                      </label>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" variant="primary" size="sm">
                        حفظ التعديلات
                      </Button>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
}
