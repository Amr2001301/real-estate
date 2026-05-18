import Link from 'next/link';
import { Plus, Users, Crown, ShieldCheck, BadgePercent, Mail, Phone, Pencil, UserCheck, UserMinus, UserX } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { BrokerUser, BrokerUserStatus, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerUserStatusBadge } from '@/components/badges';
import { ConfirmingForm } from '@/components/confirming-form';
import { setTeamMemberStatusAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  status?: BrokerUserStatus;
  q?: string;
  err?: string;
}

const PAGE_SIZE = 25;

function FlagPill({ icon: Icon, label, on }: { icon: typeof Crown; label: string; on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export default async function PortalTeamPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.status) qs.set('status', sp.status);
  if (sp.q) qs.set('q', sp.q);

  const res = await safe(api.get<Paged<BrokerUser>>(`/portal/team?${qs.toString()}`));
  const items = res.data?.data ?? [];
  const meta = res.data?.meta;

  return (
    <div className="space-y-5">
      <PageHeader
        title="فريق العمل"
        description="إدارة الموظفين المنضمين لشركة الوساطة الخاصة بك."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'فريق العمل' },
        ]}
        actions={
          <Link href="/portal/team/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إضافة عضو
            </Button>
          </Link>
        }
      />

      {sp.err && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {sp.err}
        </div>
      )}

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الفريق: {res.error}
        </div>
      )}

      <form
        method="get"
        action="/portal/team"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث بالاسم أو البريد أو الجوال"
          defaultValue={sp.q ?? ''}
          className="w-64 shrink-0"
        />
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-44 shrink-0">
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="INVITED">دعوة</option>
          <option value="SUSPENDED">موقوف</option>
          <option value="REMOVED">مُزال</option>
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.q || sp.status) && (
            <Link href="/portal/team">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="لا يوجد أعضاء فريق بعد"
            description="ابدأ بإضافة أول عضو من زر «إضافة عضو» أعلى الصفحة."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">العضو</th>
                  <th className="text-start font-semibold py-3 px-4">المسمى</th>
                  <th className="text-start font-semibold py-3 px-4">الحالة</th>
                  <th className="text-start font-semibold py-3 px-4">الصلاحيات</th>
                  <th className="text-start font-semibold py-3 px-4">انضم</th>
                  <th className="text-end font-semibold py-3 ps-4 pe-5">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-t border-hairline align-top hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3 ps-5 pe-4 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{m.user.fullName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-slate-500" dir="ltr">
                        {m.user.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {m.user.email}
                          </span>
                        )}
                        {m.user.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {m.user.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{m.jobTitle ?? '—'}</td>
                    <td className="py-3 px-4">
                      <BrokerUserStatusBadge status={m.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <FlagPill icon={Crown} label="جهة اتصال رئيسية" on={m.isPrimaryContact} />
                        <FlagPill icon={ShieldCheck} label="إدارة الفريق" on={m.canManageBrokerUsers} />
                        <FlagPill icon={BadgePercent} label="عرض العمولات" on={m.canViewCommissions} />
                        {!m.isPrimaryContact && !m.canManageBrokerUsers && !m.canViewCommissions && (
                          <span className="text-2xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {m.joinedAt ? formatDate(m.joinedAt) : <span className="text-slate-400">دعوة معلقة</span>}
                    </td>
                    <td className="py-3 ps-4 pe-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/portal/team/${m.id}/edit`}>
                          <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                            تعديل
                          </Button>
                        </Link>
                        {m.status !== 'ACTIVE' && (
                          <form action={setTeamMemberStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="ACTIVE" />
                            <Button type="submit" variant="ghost" size="sm" leftIcon={<UserCheck className="h-3.5 w-3.5" />}>
                              تفعيل
                            </Button>
                          </form>
                        )}
                        {m.status === 'ACTIVE' && (
                          <form action={setTeamMemberStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="SUSPENDED" />
                            <Button type="submit" variant="ghost" size="sm" leftIcon={<UserMinus className="h-3.5 w-3.5" />}>
                              إيقاف
                            </Button>
                          </form>
                        )}
                        {m.status !== 'REMOVED' && (
                          <ConfirmingForm
                            action={setTeamMemberStatusAction}
                            confirmMessage={`سيتم إزالة «${m.user.fullName}» من فريق العمل. هل أنت متأكد؟`}
                          >
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="REMOVED" />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              leftIcon={<UserX className="h-3.5 w-3.5" />}
                              className="text-danger-700 hover:text-danger-800 hover:bg-danger-50"
                            >
                              إزالة
                            </Button>
                          </ConfirmingForm>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {meta && meta.total > meta.pageSize && (
        <Pagination
          basePath="/portal/team"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          params={{ status: sp.status, q: sp.q }}
        />
      )}
    </div>
  );
}
