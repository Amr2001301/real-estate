import Link from 'next/link';
import {
  Users,
  UserCheck,
  AlertCircle,
  Phone,
  Mail,
  Plus,
  Download,
  Search,
  Eye,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return parts[0]![0]! + parts[parts.length - 1]![0]!;
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

const PAGE_SIZE = 20;

interface Filters {
  role?: string;
  q?: string;
  page?: string;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const sp = await searchParams;
  const role: 'CLIENT' | 'CUSTOMER' = sp.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const [currentRes, clientCountRes, customerCountRes] = await Promise.all([
    safe(
      api.get<Paged<User>>(
        `/users?role=${role}&page=${page}&pageSize=${PAGE_SIZE}`,
      ),
    ),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=1')),
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=1')),
  ]);

  let rows = currentRes.data?.data ?? [];
  // Client-side text filter (API doesn't support q on /users)
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(needle) ||
        u.email?.toLowerCase().includes(needle) ||
        u.phone?.toLowerCase().includes(needle),
    );
  }
  const total = currentRes.data?.meta.total ?? rows.length;
  const clientTotal = clientCountRes.data?.meta.total ?? 0;
  const customerTotal = customerCountRes.data?.meta.total ?? 0;

  // KPI quick stats from current page (best-effort, no extra round-trip)
  const activeOnPage = rows.filter((u) => u.active).length;
  const inactiveOnPage = rows.length - activeOnPage;

  const labels = ROLE_LABEL[role];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="العملاء"
        description="إدارة بيانات العملاء ومتابعة ارتباطهم بالفرص والحجوزات والعقود."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <IconButton label="تصدير" variant="outline" size="md">
              <Download />
            </IconButton>
            <Link href={`/dashboard/clients/new?role=${role}` as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة عميل جديد
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'إجمالي العملاء',
            value: clientTotal + customerTotal,
            icon: <Users />,
            tone: 'brand',
            primary: true,
            sub: 'بكل أنواعهم',
          },
          {
            label: 'متصفّحون',
            value: clientTotal,
            icon: <Users />,
            tone: 'info',
          },
          {
            label: 'مالكون',
            value: customerTotal,
            icon: <UserCheck />,
            tone: 'success',
          },
          {
            label: 'موقوفون (في هذه الصفحة)',
            value: inactiveOnPage,
            icon: <ShieldAlert />,
            tone: 'warning',
            sub: `من ${rows.length} ظاهر`,
          },
        ]}
      />

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/clients">
        <PremiumFilterField label="النوع" htmlFor="cli-role">
          <Select id="cli-role" name="role" inputSize="sm" defaultValue={role} className="w-36 shrink-0">
            <option value="CLIENT">متصفّحون</option>
            <option value="CUSTOMER">مالكون</option>
          </Select>
        </PremiumFilterField>

        <div className="flex-1 min-w-[180px]">
          <label htmlFor="cli-q" className="sr-only">بحث</label>
          <Input
            id="cli-q"
            name="q"
            inputSize="sm"
            defaultValue={q}
            placeholder="ابحث بالاسم، البريد، أو الهاتف…"
            leftAddon={<Search />}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="submit" variant="primary" size="sm">بحث</Button>
          {(q || role !== 'CLIENT') && (
            <Link href={'/dashboard/clients' as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {currentRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل القائمة: {currentRes.error}</p>
        </div>
      )}

      {/* ── Clients table ────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={role === 'CUSTOMER' ? <UserCheck /> : <Users />}
        title={labels.title}
        description={labels.description}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {total.toLocaleString('ar-EG')} عميل
          </span>
        }
      >
        {rows.length === 0 ? (
          <PremiumEmptyState
            icon={role === 'CUSTOMER' ? <UserCheck /> : <Users />}
            title={
              q
                ? 'لا توجد نتائج'
                : role === 'CUSTOMER'
                  ? 'لا يوجد مالكون بعد'
                  : 'لا يوجد عملاء متصفّحون بعد'
            }
            description={
              q
                ? 'جرّب تعديل كلمات البحث أو تغيير التبويب.'
                : role === 'CUSTOMER'
                  ? 'يتم ترقية العميل إلى مالك تلقائياً عند توقيع عقد.'
                  : 'يظهر هنا كل من يسجّل في المنصة من المتصفحين.'
            }
            action={
              !q ? (
                <Link href={`/dashboard/clients/new?role=${role}` as never}>
                  <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                    إضافة عميل
                  </Button>
                </Link>
              ) : undefined
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">العميل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">بيانات الاتصال</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">النوع</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ التسجيل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">آخر دخول</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((u) => (
                  <tr key={u.id} className="group hover:bg-canvas/40 transition-colors duration-100">
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase shrink-0 ring-1 ring-inset ring-white shadow-sm',
                            paletteFor(u.fullName ?? u.email ?? u.id),
                          )}
                          aria-hidden
                        >
                          {initials(u.fullName ?? u.email ?? '·')}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/clients/${u.id}` as never}
                            className="font-semibold text-[13px] text-slate-900 hover:text-brand-700 group-hover:underline underline-offset-2 decoration-brand-300/50 transition-colors truncate block"
                          >
                            {u.fullName ?? '—'}
                          </Link>
                          <p className="text-2xs text-slate-400 mt-0.5 font-mono">
                            ID: #{u.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 min-w-[190px]">
                      <div className="flex flex-col gap-1.5">
                        {u.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <a
                              href={`tel:${u.phone}`}
                              className="font-mono text-xs text-slate-700 hover:text-brand-700 transition-colors"
                              dir="ltr"
                            >
                              {u.phone}
                            </a>
                          </div>
                        ) : null}
                        {u.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <a
                              href={`mailto:${u.email}`}
                              className="text-xs text-slate-600 hover:text-brand-700 transition-colors truncate max-w-[200px]"
                              dir="ltr"
                            >
                              {u.email}
                            </a>
                          </div>
                        ) : null}
                        {!u.phone && !u.email && (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>
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
                    <td className="py-3 px-4">
                      {u.active ? (
                        <Badge tone="success" variant="soft" size="sm" dot>
                          نشط
                        </Badge>
                      ) : (
                        <Badge tone="gray" variant="soft" size="sm" dot>
                          موقوف
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                    </td>
                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/dashboard/clients/${u.id}` as never}>
                        <IconButton label="عرض تفاصيل العميل" variant="outline" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {currentRes.data && total > PAGE_SIZE && !q && (
        <Pagination
          page={currentRes.data.meta.page}
          pageSize={currentRes.data.meta.pageSize}
          total={total}
          basePath="/dashboard/clients"
          params={{ role }}
        />
      )}

      {/* ── Footer audit hint ────────────────────────────────────────────────── */}
      <p className="flex items-center justify-center gap-1.5 text-2xs text-slate-400">
        <ShieldCheck className="h-3 w-3" />
        تتبع جميع التغييرات على ملفات العملاء عبر سجل التدقيق المركزي.
      </p>
    </div>
  );
}

