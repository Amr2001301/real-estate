import Link from 'next/link';
import { Users, UserCheck, AlertCircle, Phone, Mail } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ROLE_LABEL: Record<'CLIENT' | 'CUSTOMER', { title: string; description: string }> = {
  CLIENT: {
    title: 'العملاء (متصفّحون)',
    description: 'مستخدمون مسجّلون يتصفحون المشاريع والوحدات.',
  },
  CUSTOMER: {
    title: 'العملاء (مالكون)',
    description: 'عملاء أبرموا عقوداً ويملكون وحدات داخل المحفظة.',
  },
};

function firstLetter(name: string): string {
  return name.trim().charAt(0) || '·';
}

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const role: 'CLIENT' | 'CUSTOMER' = sp.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT';

  const [currentRes, clientCountRes, customerCountRes] = await Promise.all([
    safe(api.get<Paged<User>>(`/users?role=${role}&pageSize=100`)),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=1')),
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=1')),
  ]);

  const rows = currentRes.data?.data ?? [];
  const clientTotal = clientCountRes.data?.meta.total ?? 0;
  const customerTotal = customerCountRes.data?.meta.total ?? 0;
  const labels = ROLE_LABEL[role];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={labels.title}
        description={labels.description}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء' },
        ]}
      />

      <div className="inline-flex items-center gap-1 rounded-2xl bg-surface-muted p-1 ring-1 ring-inset ring-hairline">
        <RoleTab
          href="/dashboard/clients?role=CLIENT"
          active={role === 'CLIENT'}
          icon={<Users className="h-4 w-4" />}
          label="متصفّحون"
          count={clientTotal}
        />
        <RoleTab
          href="/dashboard/clients?role=CUSTOMER"
          active={role === 'CUSTOMER'}
          icon={<UserCheck className="h-4 w-4" />}
          label="مالكون"
          count={customerTotal}
        />
      </div>

      {currentRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل القائمة: {currentRes.error}</p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الهاتف</th>
                <th className="text-start font-semibold py-3 px-4">البريد الإلكتروني</th>
                <th className="text-start font-semibold py-3 px-4">الدور</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ التسجيل</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5">آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={role === 'CUSTOMER' ? <UserCheck /> : <Users />}
                      title={
                        role === 'CUSTOMER'
                          ? 'لا يوجد مالكون بعد'
                          : 'لا يوجد عملاء متصفّحون بعد'
                      }
                      description={
                        role === 'CUSTOMER'
                          ? 'يتم ترقية العميل إلى مالك تلقائياً عند توقيع عقد.'
                          : 'يظهر هنا كل من يسجّل في المنصة من المتصفحين.'
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="py-3 ps-5 pe-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shrink-0 ring-1 ring-inset ring-white',
                          paletteFor(u.fullName ?? u.email ?? u.id),
                        )}
                        aria-hidden
                      >
                        {firstLetter(u.fullName ?? u.email ?? '·')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {u.fullName ?? '—'}
                        </p>
                        <p className="text-2xs text-slate-400 mt-0.5 font-mono">
                          #{u.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {u.phone ? (
                      <a
                        href={`tel:${u.phone}`}
                        className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 font-mono text-xs"
                        dir="ltr"
                      >
                        <Phone className="h-3 w-3 text-slate-400" />
                        {u.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.email ? (
                      <a
                        href={`mailto:${u.email}`}
                        className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 text-xs"
                        dir="ltr"
                      >
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span className="truncate max-w-[200px]">{u.email}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      tone={role === 'CUSTOMER' ? 'success' : 'info'}
                      variant="soft"
                      size="sm"
                    >
                      {role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-3 ps-4 pe-5 text-slate-500 text-xs">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RoleTab({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href as never}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors',
        active
          ? 'bg-surface text-slate-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-surface',
      )}
    >
      <span className={cn(active ? 'text-brand-600' : 'text-slate-400')}>{icon}</span>
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md text-2xs font-bold',
          active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600',
        )}
      >
        {count}
      </span>
    </Link>
  );
}
