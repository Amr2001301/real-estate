import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ShieldCheck, Info } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UserPermissionsResponse, UserRole } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { PermissionPicker } from './permission-picker';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Role display maps ─────────────────────────────────────────────────────────

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
  SALES_MANAGER:          'bg-blue-100   text-blue-700',
  SALES:                  'bg-brand-100  text-brand-700',
  MAINTENANCE_SUPERVISOR: 'bg-orange-100 text-orange-700',
  CLIENT:                 'bg-slate-100  text-slate-600',
  CUSTOMER:               'bg-teal-100   text-teal-700',
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
  if (!id) return 'bg-slate-100 text-slate-700';
  const n = id.charCodeAt(0) + (id.charCodeAt(id.length - 1) || 0);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length] ?? 'bg-slate-100 text-slate-700';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('');
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title={`صلاحيات: ${user.fullName}`}
        description="إدارة الصلاحيات التفصيلية لهذا المستخدم. لا تغيِّر هذه الصفحة الدور الأساسي."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصلاحيات', href: '/dashboard/permissions' },
          { label: user.fullName },
        ]}
        meta={<ShieldCheck className="h-4 w-4 text-brand-600" />}
        actions={
          <Link href="/dashboard/permissions">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للصلاحيات
            </Button>
          </Link>
        }
      />

      {/* ── Compact user summary ────────────────────────────────────────── */}
      <div className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-xs">
        {/* Avatar initials */}
        <span
          className={cn(
            'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold leading-none',
            avatarColor(user.id),
          )}
          aria-hidden
        >
          {initials(user.fullName)}
        </span>

        {/* Identity + contact */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-slate-900 leading-tight">{user.fullName}</span>
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded-full text-xs font-medium leading-tight',
                ROLE_BADGE_CLS[user.role] ?? 'bg-slate-100 text-slate-600',
              )}
            >
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium leading-tight',
                user.active
                  ? 'bg-success-50 text-success-700'
                  : 'bg-slate-100 text-slate-500',
              )}
            >
              {user.active ? 'نشط' : 'معطّل'}
            </span>
          </div>

          {(user.email || user.phone) && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {user.email && (
                <span className="text-xs text-slate-500 font-mono" dir="ltr">{user.email}</span>
              )}
              {user.email && user.phone && (
                <span className="text-slate-300 text-xs select-none" aria-hidden>·</span>
              )}
              {user.phone && (
                <span className="text-xs text-slate-500 font-mono" dir="ltr">{user.phone}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Info notice (compact single line) ───────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-info-100 bg-info-50 px-4 py-2.5 text-xs text-info-800">
        <Info className="h-3.5 w-3.5 shrink-0 text-info-600" />
        <span>
          الصلاحيات التفصيلية محفوظة في النظام وقد لا تكون مفعّلة على كل المسارات بعد.
          تغييرها لا يُعدِّل الدور الأساسي لـ {user.fullName}.
        </span>
      </div>

      {/* ── Permissions editor ──────────────────────────────────────────── */}
      <PermissionPicker
        userId={id}
        userName={user.fullName}
        assigned={assigned}
        available={available}
      />

    </div>
  );
}
