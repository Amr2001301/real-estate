import Link from 'next/link';
import {
  Pencil,
  Send,
  Archive,
  Building2,
  ImageIcon,
  Map as MapIcon,
  Layers,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Project, Paged, Unit } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectStatusBadge, UnitStatusBadge } from '@/components/badges';
import { ProjectHero, type HeroStat } from '@/components/projects/project-hero';
import {
  AssetActionCard,
  AssetActionForm,
  type AssetAction,
} from '@/components/projects/asset-action-card';
import { ServiceTileGrid } from '@/components/projects/service-tile-grid';
import { ProjectMap } from '@/components/maps/project-map';
import { ConfirmButton } from '@/components/confirm-button';
import {
  publishProjectAction,
  archiveProjectAction,
  deleteProjectAction,
  createPhaseAction,
  createBuildingAction,
} from '../actions';
import { ProjectMediaPanel } from './media-panel';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [projectRes, unitsRes] = await Promise.all([
    safe(api.get<Project>(`/projects/${id}`)),
    safe(api.get<Paged<Unit>>(`/units?projectId=${id}&pageSize=20`)),
  ]);

  if (projectRes.error || !projectRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل المشروع: {projectRes.error ?? 'غير موجود'}
      </div>
    );
  }

  const project = projectRes.data;
  const units = unitsRes.data?.data ?? [];
  const cover = project.media?.[0]?.url;

  // Project mutations are ADMIN-only — SALES views read-only.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  // Aggregations from real data only.
  const phaseCount = project.phases?.length ?? 0;
  const buildingCount =
    project.phases?.reduce((s, ph) => s + (ph.buildings?.length ?? 0), 0) ?? 0;
  const unitsCountFromBuildings =
    project.phases?.reduce(
      (s, ph) =>
        s + (ph.buildings?.reduce((bs, b) => bs + (b._count?.units ?? 0), 0) ?? 0),
      0,
    ) ?? 0;
  const totalUnits = unitsRes.data?.meta.total ?? unitsCountFromBuildings;
  const reserved = units.filter((u) => u.status === 'RESERVED').length;
  const sold = units.filter((u) => u.status === 'SOLD').length;
  const occupancyPct =
    units.length > 0 ? Math.round(((reserved + sold) / units.length) * 100) : null;

  const heroStats: HeroStat[] = [];
  if (totalUnits > 0) heroStats.push({ label: 'الوحدات', value: totalUnits });
  if (occupancyPct !== null)
    heroStats.push({ label: 'الإشغال', value: `${occupancyPct}%` });
  if (buildingCount > 0)
    heroStats.push({ label: 'المباني', value: buildingCount });

  const assetActions: AssetAction[] = [
    {
      key: 'units',
      label: 'الوحدات',
      icon: <Building2 />,
      href: `/dashboard/units?projectId=${project.id}`,
    },
    {
      key: 'media',
      label: 'مكتبة الوسائط',
      icon: <ImageIcon />,
      href: `/dashboard/projects/${project.id}#media`,
    },
    {
      key: 'map',
      label: 'عرض الموقع على الخريطة',
      icon: <MapIcon />,
      href: `https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`,
      external: true,
    },
    // Editing the project is ADMIN-only.
    ...(isAdmin
      ? [
          {
            key: 'edit',
            label: 'تعديل بيانات المشروع',
            icon: <Pencil />,
            href: `/dashboard/projects/${project.id}/edit`,
          } as AssetAction,
        ]
      : []),
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={tx(project.name)}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المشاريع', href: '/dashboard/projects' },
          { label: tx(project.name) },
        ]}
        meta={
          <>
            <ProjectStatusBadge status={project.status} />
            <span className="text-sm text-slate-500">
              {project.city} · {project.lat.toFixed(4)}, {project.lng.toFixed(4)}
            </span>
            {project.featured && (
              <Badge tone="accent" variant="soft">
                مميز
              </Badge>
            )}
          </>
        }
        actions={
          isAdmin ? (
            <>
              <Link href={`/dashboard/projects/${id}/edit` as never}>
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Pencil className="h-4 w-4" />}
                >
                  تعديل المشروع
                </Button>
              </Link>
              {project.status !== 'PUBLISHED' && (
                <form action={publishProjectAction.bind(null, id)}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    leftIcon={<Send className="h-4 w-4" />}
                  >
                    نشر المشروع
                  </Button>
                </form>
              )}
            </>
          ) : undefined
        }
      />

      <ProjectHero
        src={cover}
        alt={tx(project.name)}
        rightLabel="المساحة الإجمالية"
        rightValue={`${totalUnits || 0}`}
        rightSub={`${totalUnits || 0} وحدة في ${phaseCount} مرحلة`}
        stats={heroStats}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-5 w-1 rounded-full bg-brand-500" />
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                وصف المشروع
              </h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {tx(project.description) || 'لا يوجد وصف لهذا المشروع.'}
            </p>

            {project.services && project.services.length > 0 && (
              <div className="mt-6">
                <ServiceTileGrid services={project.services} />
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  مراحل المشروع
                </h2>
              </div>
              <span className="text-2xs font-semibold text-slate-500">
                {phaseCount} مرحلة · {buildingCount} مبنى
              </span>
            </div>

            {phaseCount === 0 ? (
              <EmptyState
                icon={<Layers />}
                title="لا توجد مراحل بعد"
                description="ابدأ بإضافة المرحلة الأولى للمشروع."
              />
            ) : (
              <div className="space-y-3">
                {project.phases!.map((ph, idx) => {
                  const buildingsCount = ph.buildings?.length ?? 0;
                  const totalPhaseUnits =
                    ph.buildings?.reduce(
                      (s, b) => s + (b._count?.units ?? 0),
                      0,
                    ) ?? 0;
                  return (
                    <div
                      key={ph.id}
                      className="flex items-start gap-4 rounded-2xl bg-info-50/50 border border-hairline p-4"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-inset ring-success-100 shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-2xs font-semibold text-slate-400 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm font-semibold text-slate-900">
                            {tx(ph.name)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {buildingsCount} مبنى · {totalPhaseUnits} وحدة
                        </p>
                        {ph.buildings && ph.buildings.length > 0 && (
                          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {ph.buildings.map((b) => (
                              <li
                                key={b.id}
                                className="flex items-center justify-between text-xs text-slate-600 bg-surface rounded-lg px-3 py-1.5 ring-1 ring-inset ring-hairline"
                              >
                                <span className="font-medium text-slate-700">
                                  مبنى {b.name}
                                </span>
                                <span className="text-slate-400">
                                  {b.totalFloors} طوابق · {b._count?.units ?? 0} وحدة
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {isAdmin && (
                          <details className="mt-3 group">
                            <summary className="text-2xs font-semibold text-brand-700 cursor-pointer inline-flex items-center gap-1 hover:text-brand-800">
                              <Plus className="h-3 w-3" /> إضافة مبنى
                            </summary>
                            <form
                              action={createBuildingAction.bind(null, project.id)}
                              className="mt-2 flex flex-wrap gap-2"
                            >
                              <input type="hidden" name="phaseId" value={ph.id} />
                              <input
                                name="name"
                                required
                                placeholder="اسم المبنى (A)"
                                className="text-xs h-8 rounded-lg border border-hairline bg-surface px-2.5 focus:outline-none focus:border-brand-500"
                              />
                              <input
                                name="totalFloors"
                                type="number"
                                min={1}
                                defaultValue={1}
                                placeholder="الطوابق"
                                className="w-24 text-xs h-8 rounded-lg border border-hairline bg-surface px-2.5 focus:outline-none focus:border-brand-500"
                              />
                              <Button type="submit" variant="outline" size="sm">
                                حفظ
                              </Button>
                            </form>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isAdmin && (
              <details className="mt-4 group">
                <summary className="text-sm font-semibold text-brand-700 cursor-pointer inline-flex items-center gap-1.5 hover:text-brand-800">
                  <Plus className="h-4 w-4" /> إضافة مرحلة جديدة
                </summary>
                <form
                  action={createPhaseAction.bind(null, project.id)}
                  className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2"
                >
                  <input
                    name="name_ar"
                    required
                    dir="rtl"
                    placeholder="اسم المرحلة (بالعربية)"
                    className="text-sm h-9 rounded-lg border border-hairline bg-surface px-3 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    name="name_en"
                    required
                    dir="ltr"
                    placeholder="Phase name (English)"
                    className="text-sm h-9 rounded-lg border border-hairline bg-surface px-3 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    name="order"
                    type="number"
                    defaultValue={phaseCount}
                    className="w-20 text-sm h-9 rounded-lg border border-hairline bg-surface px-3 focus:outline-none focus:border-brand-500"
                  />
                  <Button type="submit" variant="primary" size="sm">
                    إضافة
                  </Button>
                </form>
              </details>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  الوحدات المتاحة
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  نظرة سريعة على الوحدات المعروضة للبيع حالياً
                </p>
              </div>
              <Link
                href={`/dashboard/units?projectId=${project.id}` as never}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                عرض الكل
              </Link>
            </div>

            {units.length === 0 ? (
              <EmptyState
                icon={<Building2 />}
                title="لا توجد وحدات بعد"
                description="أضف وحدات إلى المباني داخل المشروع."
              />
            ) : (
              <div className="overflow-x-auto scrollbar-thin -mx-2">
                <table className="w-full text-sm">
                  <thead className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="text-start font-semibold py-2 px-2">رقم الوحدة</th>
                      <th className="text-start font-semibold py-2 px-2">النوع</th>
                      <th className="text-start font-semibold py-2 px-2">المساحة</th>
                      <th className="text-start font-semibold py-2 px-2">السعر</th>
                      <th className="text-start font-semibold py-2 px-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.slice(0, 6).map((u) => (
                      <tr key={u.id} className="border-t border-hairline">
                        <td className="py-3 px-2 font-mono text-sm font-semibold text-slate-900">
                          {u.code}
                        </td>
                        <td className="py-3 px-2 text-slate-600">{u.type}</td>
                        <td className="py-3 px-2 text-slate-700 tabular-nums">
                          {u.area} م²
                        </td>
                        <td className="py-3 px-2 font-semibold text-brand-700 tabular-nums">
                          {formatCurrency(u.price)}
                        </td>
                        <td className="py-3 px-2">
                          <UnitStatusBadge status={u.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <AssetActionCard
            title={isAdmin ? 'إدارة الأصول' : 'الأصول'}
            actions={[
              ...assetActions,
              // Publish/archive is an ADMIN-only mutation.
              ...(isAdmin
                ? [
                    {
                      key: 'archive-or-publish',
                      label:
                        project.status === 'ARCHIVED' ? 'إعادة النشر' : 'إلغاء النشر',
                      icon: <Archive />,
                      tone: 'danger' as const,
                      form: (
                        <AssetActionForm
                          label={
                            project.status === 'ARCHIVED' ? 'إعادة النشر' : 'إلغاء النشر'
                          }
                          icon={<Archive />}
                          tone="danger"
                          action={
                            project.status === 'ARCHIVED'
                              ? publishProjectAction.bind(null, id)
                              : archiveProjectAction.bind(null, id)
                          }
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">
              الموقع على الخريطة
            </h3>
            <ProjectMap
              lat={project.lat}
              lng={project.lng}
              city={project.city}
              height="md"
            />
            <p className="mt-3 text-2xs text-slate-500 font-mono" dir="ltr">
              {project.lat.toFixed(5)}, {project.lng.toFixed(5)}
            </p>
          </Card>

          <div id="media">
            <ProjectMediaPanel project={project} />
          </div>

          {isAdmin && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">
                منطقة الخطر
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                حذف المشروع سيؤدي إلى إزالته نهائياً مع جميع المراحل والمباني المرتبطة. لا يمكن التراجع.
              </p>
              <ConfirmButton
                label="حذف المشروع"
                confirm="هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع."
                action={deleteProjectAction.bind(null, id)}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
