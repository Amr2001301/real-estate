import { notFound } from 'next/navigation';
import { Star, Mail, Phone, UserPlus, Users } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerUser, BrokerUserStatus } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { BrokerUserStatusBadge } from '@/components/badges';
import { ConfirmingForm } from '@/components/confirming-form';
import {
  PremiumPageHero,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import {
  updateBrokerUserAction,
  setBrokerUserPrimaryAction,
  updateBrokerUserStatusAction,
} from '../../actions';
import CreateBrokerUserForm from './_create-form';

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

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

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="موظفو الوسيط"
        description={`إدارة الحسابات المرتبطة بشركة ${broker.companyName}.`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: broker.companyName, href: `/dashboard/brokers/${id}` as never },
          { label: 'الموظفون' },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────── */}
      {usersRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل قائمة الموظفين: {usersRes.error}
        </div>
      )}

      {/* ── Add employee ─────────────────────────────────────────────── */}
      <PremiumSectionCard title="إضافة موظف جديد" icon={<UserPlus />}>
        <p className="text-[12px] text-slate-500 mb-5">
          إذا كان لدى الشخص حساب بدور{' '}
          <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">BROKER</code>{' '}
          فسيتم ربطه بشركة الوساطة. لا يُسمح بتحويل أدوار أخرى تلقائياً.
        </p>
        <CreateBrokerUserForm brokerId={id} />
      </PremiumSectionCard>

      {/* ── Employees table ──────────────────────────────────────────── */}
      <PremiumSectionCard
        title="الموظفون الحاليون"
        icon={<Users />}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {users.length} موظف
          </span>
        }
        padded={false}
      >
        {users.length === 0 ? (
          <PremiumEmptyState
            icon={<UserPlus />}
            title="لا يوجد موظفون بعد"
            description="استخدم النموذج أعلاه لدعوة أول موظف لهذا الوسيط."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-canvas/50 border-b border-hairline">
                <tr>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">الموظف</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">الوظيفة</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">التواصل</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">الصلاحيات</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">الحالة</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">آخر دخول</th>
                  <th className="px-5 py-3 text-start w-px"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {users.map((bu) => {
                  const u = bu.user;
                  return (
                    <tr
                      key={bu.id}
                      className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                    >
                      {/* موظف */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {bu.isPrimaryContact && (
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" />
                              )}
                              <p className="text-[13px] font-semibold text-slate-900">{u.fullName}</p>
                            </div>
                            {bu.isPrimaryContact && (
                              <p className="text-[11px] text-amber-600 mt-0.5">جهة الاتصال الرئيسية</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* الوظيفة */}
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] text-slate-600">{bu.jobTitle || '—'}</span>
                      </td>

                      {/* التواصل */}
                      <td className="px-5 py-3.5" dir="ltr">
                        <div className="space-y-1">
                          {u.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="text-[12px] text-slate-700">{u.email}</span>
                            </div>
                          )}
                          {u.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="text-[12px] text-slate-700">{u.phone}</span>
                            </div>
                          )}
                          {!u.email && !u.phone && <span className="text-[12px] text-slate-300">—</span>}
                        </div>
                      </td>

                      {/* الصلاحيات */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {bu.canManageBrokerUsers && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              إدارة الموظفين
                            </span>
                          )}
                          {bu.canViewCommissions && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              عرض العمولات
                            </span>
                          )}
                          {!bu.canManageBrokerUsers && !bu.canViewCommissions && (
                            <span className="text-[12px] text-slate-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* الحالة */}
                      <td className="px-5 py-3.5">
                        <BrokerUserStatusBadge status={bu.status} />
                      </td>

                      {/* آخر دخول */}
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] text-slate-500 tabular-nums">
                          {formatDate(u.lastLoginAt) ?? '—'}
                        </span>
                      </td>

                      {/* إجراءات */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-end gap-1.5">
                          {!bu.isPrimaryContact && bu.status !== 'REMOVED' && (
                            <form action={makePrimary.bind(null, bu.id)}>
                              <button type="submit" className="text-[11px] font-semibold text-amber-700 hover:underline underline-offset-2 whitespace-nowrap">
                                تعيين رئيسي
                              </button>
                            </form>
                          )}
                          {bu.status !== 'ACTIVE' && bu.status !== 'REMOVED' && (
                            <form action={changeStatus.bind(null, bu.id, 'ACTIVE')}>
                              <button type="submit" className="text-[11px] font-semibold text-success-700 hover:underline underline-offset-2 whitespace-nowrap">
                                تفعيل
                              </button>
                            </form>
                          )}
                          {bu.status === 'ACTIVE' && (
                            <form action={changeStatus.bind(null, bu.id, 'SUSPENDED')}>
                              <button type="submit" className="text-[11px] font-semibold text-amber-700 hover:underline underline-offset-2 whitespace-nowrap">
                                إيقاف مؤقت
                              </button>
                            </form>
                          )}
                          {bu.status !== 'REMOVED' && (
                            <ConfirmingForm
                              action={changeStatus.bind(null, bu.id, 'REMOVED')}
                              confirmMessage={`سيتم حذف «${bu.user.fullName}» من قائمة موظفي الوسيط. هل أنت متأكد؟`}
                            >
                              <button type="submit" className="text-[11px] font-semibold text-danger-600 hover:underline underline-offset-2 whitespace-nowrap">
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
        )}
      </PremiumSectionCard>

      {/* ── Edit employees ───────────────────────────────────────────── */}
      {users.length > 0 && (
        <PremiumSectionCard title="تعديل بيانات موظف" padded={false}>
          <div className="divide-y divide-hairline">
            {users.map((bu) => {
              const u = bu.user;
              return (
                <details key={bu.id} className="group">
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-canvas/40 transition-colors duration-100">
                    {/* Identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-[13px] font-bold">
                        {u.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {bu.isPrimaryContact && <Star className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" />}
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{u.fullName}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate" dir="ltr">
                          {u.email ?? u.phone ?? '—'}
                        </p>
                      </div>
                    </div>
                    {/* Meta + toggle */}
                    <div className="flex items-center gap-3 shrink-0">
                      {bu.jobTitle && (
                        <span className="text-[12px] text-slate-500 hidden sm:block">{bu.jobTitle}</span>
                      )}
                      <BrokerUserStatusBadge status={bu.status} />
                      <span className="inline-flex items-center rounded-lg bg-brand-50 border border-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700 group-open:hidden">
                        تعديل
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-slate-100 border border-hairline px-2.5 py-1 text-[11px] font-semibold text-slate-500 hidden group-open:inline-flex">
                        إغلاق
                      </span>
                    </div>
                  </summary>
                  <div className="px-5 py-5 border-t border-hairline bg-canvas/30">
                    <form action={updateUser.bind(null, bu.id)} className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="الاسم الكامل">
                          <Input id={`fullName-${bu.id}`} name="fullName" defaultValue={u.fullName} />
                        </FormField>
                        <FormField label="الوظيفة">
                          <Input id={`jobTitle-${bu.id}`} name="jobTitle" defaultValue={bu.jobTitle ?? ''} />
                        </FormField>
                        <FormField label="البريد الإلكتروني">
                          <Input id={`email-${bu.id}`} name="email" type="email" dir="ltr" defaultValue={u.email ?? ''} />
                        </FormField>
                        <FormField label="رقم الجوال">
                          <Input id={`phone-${bu.id}`} name="phone" dir="ltr" defaultValue={u.phone ?? ''} />
                        </FormField>
                      </div>
                      <div className="pt-4 border-t border-hairline">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-3">الصلاحيات</p>
                        <div className="flex flex-wrap items-center gap-5">
                          <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
                            <Checkbox name="canManageBrokerUsers" defaultChecked={bu.canManageBrokerUsers} />
                            <span>صلاحية إدارة الموظفين</span>
                          </label>
                          <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
                            <Checkbox name="canViewCommissions" defaultChecked={bu.canViewCommissions} />
                            <span>عرض العمولات</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" variant="primary" size="sm">حفظ التعديلات</Button>
                      </div>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        </PremiumSectionCard>
      )}

    </div>
  );
}
