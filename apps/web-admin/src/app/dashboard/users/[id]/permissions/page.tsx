import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ShieldCheck, Info, Mail, Phone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UserPermissionsResponse, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { PermissionPicker } from './permission-picker';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

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
      <PremiumPageHero
        title={`صلاحيات: ${user.fullName}`}
        description="إدارة الصلاحيات التفصيلية لهذا المستخدم. لا تغيِّر هذه الصفحة الدور الأساسي."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصلاحيات', href: '/dashboard/permissions' },
          { label: user.fullName },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            صلاحيات شخصية
          </span>
        }
        actions={
          <Link href="/dashboard/permissions">
            <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للصلاحيات
            </Button>
          </Link>
        }
      />

      {/* ── User identity card ──────────────────────────────────────────── */}
      <PremiumSectionCard title="معلومات المستخدم" padded={false}>
        <div className="flex items-center gap-5 px-6 py-5">
          {/* Avatar */}
          <span
            className={cn(
              'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold leading-none',
              avatarColor(user.id),
            )}
            aria-hidden
          >
            {initials(user.fullName)}
          </span>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[17px] font-bold text-slate-900 leading-tight">
                {user.fullName}
              </span>
              <span
                className={cn(
                  'inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold leading-tight',
                  ROLE_BADGE_CLS[user.role] ?? 'bg-slate-100 text-slate-600',
                )}
              >
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              <span
                className={cn(
                  'inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold leading-tight',
                  user.active
                    ? 'bg-success-50 text-success-700 border border-success-200'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {user.active ? 'نشط' : 'معطّل'}
              </span>
            </div>

            {(user.email || user.phone) && (
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                {user.email && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="font-mono" dir="ltr">{user.email}</span>
                  </span>
                )}
                {user.phone && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                    <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="font-mono" dir="ltr">{user.phone}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </PremiumSectionCard>

      {/* ── Info notice ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-[12px] text-brand-800">
        <Info className="h-4 w-4 shrink-0 text-brand-600" />
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
