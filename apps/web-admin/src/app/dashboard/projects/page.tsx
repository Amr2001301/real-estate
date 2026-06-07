import Link from 'next/link';
import {
  Plus,
  Building2,
  CheckCircle2,
  MapPinned,
  Star,
  Eye,
  Pencil,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Project } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectStatusBadge } from '@/components/badges';
import { ProjectThumbnail } from '@/components/projects/project-thumbnail';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  status?: string;
  city?: string;
}

const PAGE_SIZE = 12;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.status) qs.set('status', sp.status);
  if (sp.city) qs.set('city', sp.city);

  // For the city dropdown + KPI strip we also pull a wider snapshot.
  const [pagedRes, snapshotRes] = await Promise.all([
    safe(api.get<Paged<Project>>(`/projects?${qs.toString()}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = pagedRes.data;
  const snapshot = snapshotRes.data;

  // Client-side filter fallback: if API ignores ?status / ?city, narrow down here.
  let rows = paged?.data ?? [];
  if (sp.status) rows = rows.filter((p) => p.status === sp.status);
  if (sp.city) rows = rows.filter((p) => p.city === sp.city);

  const allProjects = snapshot?.data ?? [];
  const cities = Array.from(new Set(allProjects.map((p) => p.city).filter(Boolean)));

  // Project mutations are ADMIN-only (projects:create/update/publish/delete).
  // SALES browses read-only, so creation CTAs are hidden for them.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  // KPI computation from real data (no fakes).
  const total = paged?.meta.total ?? allProjects.length;
  const published = allProjects.filter((p) => p.status === 'PUBLISHED').length;
  const drafts = allProjects.filter((p) => p.status === 'DRAFT').length;
  const featuredCount = allProjects.filter((p) => p.featured).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="قائمة المشاريع"
        description="إدارة ومراقبة أداء المحفظة العقارية الحالية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المشاريع' },
        ]}
        actions={
          isAdmin ? (
            <Link href={'/dashboard/projects/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة مشروع جديد
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي المشاريع"
          value={total}
          icon={<Building2 />}
          tone="brand"
        />
        <PageKpiCard
          label="مشاريع منشورة"
          value={published}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <PageKpiCard
          label="مسودات"
          value={drafts}
          icon={<Pencil />}
          tone="warning"
        />
        <PageKpiCard
          label="مشاريع مميزة"
          value={featuredCount}
          icon={<Star />}
          tone="accent"
        />
      </div>

      {pagedRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المشاريع: {pagedRes.error}
        </div>
      )}

      <form method="get" action="/dashboard/projects" className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs">
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36 shrink-0">
          <option value="">كل الحالات</option>
          <option value="DRAFT">مسودة</option>
          <option value="PUBLISHED">منشور</option>
          <option value="ARCHIVED">مؤرشف</option>
        </Select>
        <Select name="city" inputSize="sm" defaultValue={sp.city ?? ''} className="w-36 shrink-0">
          <option value="">كل المدن</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.status || sp.city) && (
            <Link href="/dashboard/projects">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الموقع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المراحل</th>
                <th className="text-start font-semibold py-3 px-4">النوع</th>
                <th className="text-start font-semibold py-3 px-4">آخر تحديث</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<Building2 />}
                      title="لا توجد مشاريع بعد"
                      description="ابدأ بإضافة أول مشروع لمحفظتك العقارية."
                      action={
                        isAdmin ? (
                          <Link href={'/dashboard/projects/new' as never}>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Plus className="h-4 w-4" />}
                            >
                              إضافة مشروع
                            </Button>
                          </Link>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const cover = p.media?.[0]?.url;
                const phaseCount = p.phases?.length ?? 0;
                return (
                  <tr key={p.id} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-center gap-3">
                        <ProjectThumbnail src={cover} alt={tx(p.name)} size="md" />
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/projects/${p.id}` as never}
                            className="font-semibold text-slate-900 hover:text-brand-700 transition-colors"
                          >
                            {tx(p.name)}
                          </Link>
                          <p className="text-2xs text-slate-400 mt-0.5 font-mono">
                            ID: PJ-{p.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinned className="h-3.5 w-3.5 text-slate-400" />
                        {p.city || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <ProjectStatusBadge status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums">
                      {phaseCount > 0 ? `${phaseCount} مرحلة` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {p.featured ? (
                        <span className="inline-flex items-center gap-1 text-accent-700 text-xs font-semibold">
                          <Star className="h-3.5 w-3.5 fill-current" /> مميز
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">قياسي</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {formatDate(p.updatedAt)}
                    </td>
                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/dashboard/projects/${p.id}` as never}>
                        <IconButton label="عرض تفاصيل المشروع" variant="outline" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/dashboard/projects"
            params={{ status: sp.status, city: sp.city }}
          />
        )}
      </Card>
    </div>
  );
}
