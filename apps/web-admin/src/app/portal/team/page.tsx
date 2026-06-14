import Link from 'next/link';
import {
  Plus,
  Users,
  Crown,
  ShieldCheck,
  BadgePercent,
  Mail,
  Phone,
  Pencil,
  UserCheck,
  UserMinus,
  UserX,
  UserPlus,
  PauseCircle,
  AlertCircle,
} from 'lucide-react';
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
import { PageKpiCard } from '@/components/ui/page-kpi-card';
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

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function PermissionPill({
  icon: Icon,
  label,
  on,
}: {
  icon: typeof Crown;
  label: string;
  on: boolean;
}) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
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
  if (sp.q)      qs.set('q', sp.q);

  const [res, rActive, rInvited, rSuspended] = await Promise.all([
    safe(api.get<Paged<BrokerUser>>(`/portal/team?${qs.toString()}`)),
    safe(api.get<Paged<BrokerUser>>('/portal/team?page=1&pageSize=1&status=ACTIVE')),
    safe(api.get<Paged<BrokerUser>>('/portal/team?page=1&pageSize=1&status=INVITED')),
    safe(api.get<Paged<BrokerUser>>('/portal/team?page=1&pageSize=1&status=SUSPENDED')),
  ]);

  const items          = res.data?.data ?? [];
  const meta           = res.data?.meta;
  const totalAll       = meta?.total       ?? 0;
  const activeCount    = rActive.data?.meta.total    ?? 0;
  const invitedCount   = rInvited.data?.meta.total   ?? 0;
  const suspendedCount = rSuspended.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="فريق العمل"
        description="إدارة الموظفين المنضمين لشركة الوساطة — التحكم بالصلاحيات والحالة."
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
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {sp.err}
        </div>
      )}
      {res.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل الفريق: {res.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard label="إجمالي الأعضاء"  value={totalAll}       icon={<Users />}      tone="brand"   />
        <PageKpiCard label="نشط"             value={activeCount}    icon={<UserCheck />}  tone="success" />
        <PageKpiCard label="دعوة معلقة"      value={invitedCount}   icon={<UserPlus />}   tone="warning" />
        <PageKpiCard label="موقوف"           value={suspendedCount} icon={<PauseCircle />} tone="danger"  />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
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

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="لا يوجد أعضاء فريق بعد"
            description="ابدأ بإضافة أول عضو من زر «إضافة عضو» أعلى الصفحة."
          />
        ) : (
          <>
            {meta && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
                <span className="font-bold text-slate-700">{meta.total}</span>
                <span>عضو في الفريق</span>
              </div>
            )}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-start font-semibold py-3 ps-5 pe-4">العضو</th>
                    <th className="text-start font-semibold py-3 px-4">الحالة</th>
                    <th className="text-start font-semibold py-3 px-4">الصلاحيات</th>
                    <th className="text-start font-semibold py-3 px-4">انضم</th>
                    <th className="text-end font-semibold py-3 ps-4 pe-5">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr
                      key={m.id}
                      className="border-t border-hairline align-middle hover:bg-surface-muted/40 transition-colors"
                    >
                      {/* Member identity */}
                      <td className="py-3 ps-5 pe-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(m.user.fullName)}`}
                          >
                            {initials(m.user.fullName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{m.user.fullName}</p>
                            {m.jobTitle && (
                              <p className="text-2xs text-slate-500 mt-0.5 truncate">{m.jobTitle}</p>
                            )}
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-slate-400" dir="ltr">
                              {m.user.email && (
                                <a
                                  href={`mailto:${m.user.email}`}
                                  className="inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                                >
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate max-w-[140px]">{m.user.email}</span>
                                </a>
                              )}
                              {m.user.phone && (
                                <a
                                  href={`tel:${m.user.phone}`}
                                  className="inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                                >
                                  <Phone className="h-3 w-3" />
                                  {m.user.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <BrokerUserStatusBadge status={m.status} />
                      </td>

                      {/* Permissions */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <PermissionPill icon={Crown}       label="جهة اتصال رئيسية" on={m.isPrimaryContact} />
                          <PermissionPill icon={ShieldCheck} label="إدارة الفريق"      on={m.canManageBrokerUsers} />
                          <PermissionPill icon={BadgePercent} label="عرض العمولات"     on={m.canViewCommissions} />
                          {!m.isPrimaryContact && !m.canManageBrokerUsers && !m.canViewCommissions && (
                            <span className="text-2xs text-slate-400">لا توجد صلاحيات إضافية</span>
                          )}
                        </div>
                      </td>

                      {/* Join date */}
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {m.joinedAt ? (
                          formatDate(m.joinedAt)
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-2xs">
                            <Mail className="h-3 w-3" />
                            دعوة معلقة
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 ps-4 pe-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/portal/team/${m.id}/edit`}>
                            <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                              تعديل
                            </Button>
                          </Link>

                          {m.status !== 'ACTIVE' && (
                            <form action={setTeamMemberStatusAction}>
                              <input type="hidden" name="id"     value={m.id} />
                              <input type="hidden" name="status" value="ACTIVE" />
                              <Button type="submit" variant="ghost" size="sm" leftIcon={<UserCheck className="h-3.5 w-3.5" />}>
                                تفعيل
                              </Button>
                            </form>
                          )}

                          {m.status === 'ACTIVE' && (
                            <form action={setTeamMemberStatusAction}>
                              <input type="hidden" name="id"     value={m.id} />
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
                              <input type="hidden" name="id"     value={m.id} />
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
          </>
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
