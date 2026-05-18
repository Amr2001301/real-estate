import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, Building2, Home } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Broker,
  BrokerAccessBundle,
  Paged,
  Project,
  Unit,
} from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/form/field';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmButton } from '@/components/confirm-button';
import { UnitStatusBadge, ProjectStatusBadge } from '@/components/badges';
import { UnitAccessGrantForm } from './_unit-access-form';
import {
  grantProjectAccessAction,
  revokeProjectAccessAction,
  grantUnitAccessAction,
  revokeUnitAccessAction,
} from '../../actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Tab = 'projects' | 'units';

export default async function BrokerAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'units' ? 'units' : 'projects';

  const [brokerRes, accessRes, projectsRes, unitsRes] = await Promise.all([
    safe(api.get<Broker>(`/brokers/${id}`)),
    safe(api.get<BrokerAccessBundle>(`/brokers/${id}/access`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    tab === 'units'
      ? safe(api.get<Paged<Unit>>('/units?pageSize=500'))
      : Promise.resolve({ data: null, error: null } as const),
  ]);
  if (brokerRes.error || !brokerRes.data) notFound();

  const broker = brokerRes.data;
  const access = accessRes.data ?? { projects: [], units: [] };
  const allProjects = projectsRes.data?.data ?? [];
  const allUnits = unitsRes.data?.data ?? [];

  // Bind delete actions for inline forms.
  async function revokeProject(projectId: string) {
    'use server';
    await revokeProjectAccessAction(id, projectId);
  }
  async function revokeUnit(unitId: string) {
    'use server';
    await revokeUnitAccessAction(id, unitId);
  }
  async function grantProject(formData: FormData) {
    'use server';
    await grantProjectAccessAction(id, formData);
  }
  async function grantUnit(formData: FormData) {
    'use server';
    await grantUnitAccessAction(id, formData);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="صلاحيات الوسيط"
        description={`المشاريع والوحدات التي يحق لشركة ${broker.companyName} العمل عليها.`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: broker.companyName, href: `/dashboard/brokers/${id}` },
          { label: 'الصلاحيات' },
        ]}
        actions={
          <Link href={`/dashboard/brokers/${id}` as never}>
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للوسيط
            </Button>
          </Link>
        }
        meta={
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            النسبة الافتراضية: {Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%
          </span>
        }
      />

      {accessRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الصلاحيات: {accessRes.error}
        </div>
      )}

      <Tabs
        items={[
          {
            label: 'المشاريع',
            href: `/dashboard/brokers/${id}/access?tab=projects`,
            count: access.projects.length,
          },
          {
            label: 'الوحدات',
            href: `/dashboard/brokers/${id}/access?tab=units`,
            count: access.units.length,
          },
        ]}
        activeHref={`/dashboard/brokers/${id}/access?tab=${tab}`}
      />

      {tab === 'projects' && (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-600" />
              منح صلاحية وصول لمشروع
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              إن وُجدت صلاحية سابقة لنفس المشروع سيتم تحديثها وإعادة تفعيلها بدلاً من إنشاء صف مكرر.
            </p>
            <form action={grantProject} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="المشروع" name="projectId" required>
                <Select id="projectId" name="projectId" required defaultValue="">
                  <option value="" disabled>
                    اختر مشروعاً
                  </option>
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {tx(p.name)} — {p.city}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="نسبة العمولة (%)" name="commissionPct" hint="اختياري — تتجاوز النسبة الافتراضية">
                <Input
                  id="commissionPct"
                  name="commissionPct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                />
              </Field>
              <Field label="مبلغ ثابت لكل وحدة" name="fixedAmountPerUnit" hint="عند نموذج FIXED_PER_UNIT">
                <Input
                  id="fixedAmountPerUnit"
                  name="fixedAmountPerUnit"
                  type="number"
                  min={0}
                  step="0.01"
                />
              </Field>
              <Field label="بدء السريان" name="startsAt">
                <Input id="startsAt" name="startsAt" type="date" />
              </Field>
              <Field label="انتهاء السريان" name="endsAt">
                <Input id="endsAt" name="endsAt" type="date" />
              </Field>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 h-10">
                  <Checkbox name="active" defaultChecked />
                  <span>مفعّل</span>
                </label>
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button type="submit" variant="primary" size="md">
                  منح الصلاحية
                </Button>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-start font-semibold py-3 ps-5 pe-4">المشروع</th>
                    <th className="text-start font-semibold py-3 px-4">الحالة</th>
                    <th className="text-start font-semibold py-3 px-4">العمولة</th>
                    <th className="text-start font-semibold py-3 px-4">سريان</th>
                    <th className="text-start font-semibold py-3 px-4">الإضافة</th>
                    <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
                  </tr>
                </thead>
                <tbody>
                  {access.projects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <EmptyState
                          icon={<Building2 />}
                          title="لا توجد مشاريع متاحة للوسيط"
                          description="استخدم النموذج أعلاه لمنح صلاحية أول مشروع."
                        />
                      </td>
                    </tr>
                  )}
                  {access.projects.map((pa) => {
                    const pct =
                      pa.commissionPct !== null && pa.commissionPct !== undefined
                        ? `${Number(pa.commissionPct).toFixed(2)}%`
                        : null;
                    const fixed =
                      pa.fixedAmountPerUnit !== null && pa.fixedAmountPerUnit !== undefined
                        ? `${Number(pa.fixedAmountPerUnit).toFixed(2)} / وحدة`
                        : null;
                    return (
                      <tr
                        key={pa.id}
                        className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                      >
                        <td className="py-3 ps-5 pe-4">
                          <Link
                            href={`/dashboard/projects/${pa.projectId}` as never}
                            className="font-medium text-slate-900 hover:text-brand-700"
                          >
                            {tx(pa.project.name)}
                          </Link>
                          <p className="text-2xs text-slate-500 mt-0.5">
                            {pa.project.city} • <ProjectStatusBadge status={pa.project.status} />
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          {pa.active ? (
                            <span className="inline-block rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                              مفعّل
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 text-xs font-medium">
                              معطّل
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {pct ?? fixed ?? <span className="text-slate-400">يستخدم الافتراضي</span>}
                        </td>
                        <td className="py-3 px-4 text-2xs text-slate-500">
                          {pa.startsAt || pa.endsAt
                            ? `${formatDate(pa.startsAt)} → ${formatDate(pa.endsAt)}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-2xs text-slate-500">
                          {formatDate(pa.createdAt)}
                        </td>
                        <td className="py-3 ps-4 pe-5">
                          {pa.active && (
                            <ConfirmButton
                              label="إلغاء الصلاحية"
                              confirm={`هل تريد إلغاء صلاحية الوسيط على مشروع "${tx(pa.project.name)}"؟`}
                              action={revokeProject.bind(null, pa.projectId)}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'units' && (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Home className="h-4 w-4 text-brand-600" />
              منح صلاحية وصول لوحدة
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              عادةً تُمنح الصلاحيات على مستوى المشروع. استخدم هذا الجزء عند الحاجة لتقييد وحدات بعينها فقط.
              لا يمكن منح صلاحية وصول لوحدة محجوزة أو مباعة.
            </p>
            <UnitAccessGrantForm action={grantUnit} allUnits={allUnits} projects={allProjects} />
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-start font-semibold py-3 ps-5 pe-4">الوحدة</th>
                    <th className="text-start font-semibold py-3 px-4">المشروع</th>
                    <th className="text-start font-semibold py-3 px-4">حالة الوحدة</th>
                    <th className="text-start font-semibold py-3 px-4">صلاحية</th>
                    <th className="text-start font-semibold py-3 px-4">الإضافة</th>
                    <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
                  </tr>
                </thead>
                <tbody>
                  {access.units.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <EmptyState
                          icon={<Home />}
                          title="لا توجد وحدات مقيدة"
                          description="استخدم النموذج أعلاه لتقييد صلاحية الوسيط على وحدات محددة."
                        />
                      </td>
                    </tr>
                  )}
                  {access.units.map((ua) => (
                    <tr
                      key={ua.id}
                      className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                    >
                      <td className="py-3 ps-5 pe-4">
                        <p className="font-mono font-medium text-slate-900" dir="ltr">
                          {ua.unit.code}
                        </p>
                        <p className="text-2xs text-slate-500 mt-0.5">{ua.unit.type}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {ua.unit.building?.name ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        <UnitStatusBadge status={ua.unit.status} />
                      </td>
                      <td className="py-3 px-4">
                        {ua.active ? (
                          <span className="inline-block rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                            مفعّل
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 text-xs font-medium">
                            معطّل
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-2xs text-slate-500">
                        {formatDate(ua.createdAt)}
                      </td>
                      <td className="py-3 ps-4 pe-5">
                        {ua.active && (
                          <ConfirmButton
                            label="إلغاء الصلاحية"
                            confirm={`هل تريد إلغاء صلاحية الوسيط على الوحدة ${ua.unit.code}؟`}
                            action={revokeUnit.bind(null, ua.unitId)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
