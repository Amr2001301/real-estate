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
  Home,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Project, Paged, Unit } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectStatusBadge, UnitStatusBadge } from '@/components/badges';
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
  const currency = await getReportsCurrency();

  const [projectRes, unitsRes] = await Promise.all([
    safe(api.get<Project>(`/projects/${id}`)),
    safe(api.get<Paged<Unit>>(`/units?projectId=${id}&pageSize=20`)),
  ]);

  if (projectRes.error || !projectRes.data) {
    return (
      <div className="rounded-[18px] bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
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

  const snapshots = [
    {
      label: 'إجمالي الوحدات',
      value: totalUnits || 0,
      icon: <Building2 className="h-[17px] w-[17px]" />,
      iconCls: 'bg-brand-50 text-brand-600 ring-brand-100',
      valueCls: 'text-navy',
      primary: true,
    },
    {
      label: 'المراحل',
      value: phaseCount,
      icon: <Layers className="h-[17px] w-[17px]" />,
      iconCls: 'bg-info-50 text-info-600 ring-info-100',
      valueCls: 'text-info-700',
    },
    {
      label: 'المباني',
      value: buildingCount,
      icon: <Home className="h-[17px] w-[17px]" />,
      iconCls: 'bg-success-50 text-success-600 ring-success-100',
      valueCls: 'text-success-700',
    },
    {
      label: 'نسبة الإشغال',
      value: occupancyPct !== null ? `${occupancyPct}%` : '—',
      icon: <TrendingUp className="h-[17px] w-[17px]" />,
      iconCls: 'bg-amber-50 text-amber-600 ring-amber-100',
      valueCls: 'text-amber-700',
    },
  ] as const;

  return (
    <div className="space-y-6">

      {/* ── Premium Project Hero ─────────────────────────────────────────────── */}
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">

          {/* Breadcrumbs */}
          <nav aria-label="breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  لوحة التحكم
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard/projects' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  المشاريع
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600 truncate max-w-[200px] inline-block">
                  {tx(project.name)}
                </span>
              </li>
            </ol>
          </nav>

          {/* Title row + cover thumbnail */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2.5">
                <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-navy leading-tight">
                  {tx(project.name)}
                </h1>
                <ProjectStatusBadge status={project.status} />
                {project.featured && (
                  <Badge tone="accent" variant="soft">مميز</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {project.city}
                {project.lat && project.lng && (
                  <span className="font-mono text-slate-400 ms-1.5">
                    · {project.lat.toFixed(4)}, {project.lng.toFixed(4)}
                  </span>
                )}
              </p>

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2.5 mt-6 pt-5 border-t border-hairline">
                  <Link href={`/dashboard/projects/${id}/edit` as never}>
                    <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
                      تعديل المشروع
                    </Button>
                  </Link>
                  {project.status !== 'PUBLISHED' && (
                    <form action={publishProjectAction.bind(null, id)}>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        leftIcon={<Send className="h-4 w-4" />}
                      >
                        نشر المشروع
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Cover image thumbnail — only if media exists */}
            {cover && (
              <div className="sm:shrink-0 sm:w-52 h-36 w-full overflow-hidden rounded-[14px] border border-hairline shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt={tx(project.name)}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Snapshot Metrics Strip ───────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline">
          {snapshots.map((stat, idx) => (
            <div
              key={stat.label}
              className={cn(
                'bg-surface px-6 py-5 flex flex-col gap-3',
                idx === 0 && 'bg-canvas/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 shrink-0',
                  stat.iconCls,
                )}>
                  {stat.icon}
                </span>
                <p className="text-[11px] font-semibold text-slate-400 text-end leading-snug max-w-[80px]">
                  {stat.label}
                </p>
              </div>
              <p className={cn('text-[26px] font-black tabular-nums leading-none tracking-tight', stat.valueCls)}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Description card */}
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-canvas/30 border-b border-hairline">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 shrink-0">
                <span className="block h-[3px] w-4 rounded-full bg-brand-500" />
              </span>
              <h2 className="text-[14px] font-bold text-navy">وصف المشروع</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-[13.5px] text-slate-700 leading-relaxed">
                {tx(project.description) || 'لا يوجد وصف لهذا المشروع.'}
              </p>
              {project.services && project.services.length > 0 && (
                <div className="mt-6">
                  <ServiceTileGrid services={project.services} />
                </div>
              )}
            </div>
          </div>

          {/* Phases card */}
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-canvas/30 border-b border-hairline">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 shrink-0">
                  <Layers className="h-[15px] w-[15px] text-brand-600" />
                </span>
                <h2 className="text-[14px] font-bold text-navy">مراحل المشروع</h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                {phaseCount} مرحلة · {buildingCount} مبنى
              </span>
            </div>
            <div className="px-6 py-5">
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
                      ph.buildings?.reduce((s, b) => s + (b._count?.units ?? 0), 0) ?? 0;
                    return (
                      <div
                        key={ph.id}
                        className="flex items-start gap-4 rounded-[16px] bg-canvas/40 border border-hairline p-4 hover:border-brand-200/60 hover:bg-surface transition-all duration-150"
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-inset ring-success-100 shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <p className="text-[13.5px] font-bold text-navy">{tx(ph.name)}</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {buildingsCount} مبنى · {totalPhaseUnits} وحدة
                          </p>
                          {ph.buildings && ph.buildings.length > 0 && (
                            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {ph.buildings.map((b) => (
                                <li
                                  key={b.id}
                                  className="flex items-center justify-between text-xs text-slate-600 bg-surface rounded-[10px] px-3 py-1.5 ring-1 ring-inset ring-hairline"
                                >
                                  <span className="font-medium text-slate-700">مبنى {b.name}</span>
                                  <span className="text-slate-400">
                                    {b.totalFloors} طوابق · {b._count?.units ?? 0} وحدة
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {isAdmin && (
                            <details className="mt-3 group">
                              <summary className="text-[11px] font-semibold text-brand-700 cursor-pointer inline-flex items-center gap-1 hover:text-brand-800">
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
                                <Button type="submit" variant="outline" size="sm">حفظ</Button>
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
                    <Button type="submit" variant="primary" size="sm">إضافة</Button>
                  </form>
                </details>
              )}
            </div>
          </div>

          {/* Available units card */}
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-canvas/30 border-b border-hairline">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 shrink-0">
                  <Building2 className="h-[15px] w-[15px] text-brand-600" />
                </span>
                <div>
                  <h2 className="text-[14px] font-bold text-navy leading-none">الوحدات المتاحة</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    نظرة سريعة على الوحدات المعروضة للبيع حالياً
                  </p>
                </div>
              </div>
              <Link
                href={`/dashboard/units?projectId=${project.id}` as never}
                className="text-[12px] font-semibold text-brand-700 hover:text-brand-800 shrink-0 transition-colors"
              >
                عرض الكل
              </Link>
            </div>

            {units.length === 0 ? (
              <div className="px-6 py-4">
                <EmptyState
                  icon={<Building2 />}
                  title="لا توجد وحدات بعد"
                  description="أضف وحدات إلى المباني داخل المشروع."
                />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-canvas/40 border-b border-hairline">
                      <th className="text-start text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 py-3 ps-6 pe-3">رقم الوحدة</th>
                      <th className="text-start text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 py-3 px-3">النوع</th>
                      <th className="text-start text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 py-3 px-3">المساحة</th>
                      <th className="text-start text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 py-3 px-3">السعر</th>
                      <th className="text-start text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 py-3 px-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.slice(0, 6).map((u) => (
                      <tr key={u.id} className="border-t border-hairline hover:bg-canvas/40 transition-colors duration-100">
                        <td className="py-3.5 ps-6 pe-3 font-mono text-[13px] font-bold text-navy">
                          {u.code}
                        </td>
                        <td className="py-3.5 px-3 text-[13px] text-slate-600">{u.type}</td>
                        <td className="py-3.5 px-3 text-[13px] text-slate-700 tabular-nums">
                          {u.area} م²
                        </td>
                        <td className="py-3.5 px-3 text-[13px] font-semibold text-brand-700 tabular-nums">
                          {formatCurrency(u.price, currency)}
                        </td>
                        <td className="py-3.5 px-3">
                          <UnitStatusBadge status={u.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Side control panel ──────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Asset management — dark navy */}
          <AssetActionCard
            title={isAdmin ? 'إدارة الأصول' : 'الأصول'}
            actions={[
              ...assetActions,
              ...(isAdmin
                ? [
                    {
                      key: 'archive-or-publish',
                      label: project.status === 'ARCHIVED' ? 'إعادة النشر' : 'إلغاء النشر',
                      icon: <Archive />,
                      tone: 'danger' as const,
                      form: (
                        <AssetActionForm
                          label={project.status === 'ARCHIVED' ? 'إعادة النشر' : 'إلغاء النشر'}
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

          {/* Map card */}
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-canvas/30 border-b border-hairline">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 shrink-0">
                <MapIcon className="h-[15px] w-[15px] text-brand-600" />
              </span>
              <h3 className="text-[13.5px] font-bold text-navy">الموقع على الخريطة</h3>
            </div>
            <div className="p-4">
              <ProjectMap
                lat={project.lat}
                lng={project.lng}
                city={project.city}
                height="md"
              />
              <p className="mt-3 text-[11px] text-slate-400 font-mono" dir="ltr">
                {project.lat.toFixed(5)}, {project.lng.toFixed(5)}
              </p>
            </div>
          </div>

          {/* Media library */}
          <div id="media">
            <ProjectMediaPanel project={project} />
          </div>

          {/* Danger zone */}
          {isAdmin && (
            <div className="bg-surface border border-danger-100 rounded-[20px] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-danger-50/40 border-b border-danger-100/80">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-danger-50 ring-1 ring-danger-100 shrink-0">
                  <AlertTriangle className="h-[15px] w-[15px] text-danger-600" />
                </span>
                <h3 className="text-[13.5px] font-bold text-danger-700">منطقة الخطر</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-[12.5px] text-slate-500 mb-4 leading-relaxed">
                  حذف المشروع سيؤدي إلى إزالته نهائياً مع جميع المراحل والمباني المرتبطة. لا يمكن التراجع.
                </p>
                <ConfirmButton
                  label="حذف المشروع"
                  confirm="هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع."
                  action={deleteProjectAction.bind(null, id)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
