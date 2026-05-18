import Link from 'next/link';
import { Building2, MapPinned, ArrowLeft } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalProject } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalProjectsPage() {
  const r = await safe(api.get<PortalProject[]>('/portal/projects'));
  const projects = r.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المشاريع المتاحة"
        description="قائمة المشاريع التي يحق لك العمل عليها وفقاً للصلاحيات الممنوحة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'المشاريع' },
        ]}
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المشاريع: {r.error}
        </div>
      )}

      {projects.length === 0 && !r.error ? (
        <Card className="p-0">
          <EmptyState
            icon={<Building2 />}
            title="لا توجد مشاريع متاحة بعد"
            description="بمجرد منحك صلاحيات على أي مشروع، ستظهر تفاصيله هنا."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const cover = p.project.media?.[0]?.url;
            const pct =
              p.access.commissionPct !== null && p.access.commissionPct !== undefined
                ? `${Number(p.access.commissionPct).toFixed(2)}%`
                : null;
            const fixed =
              p.access.fixedAmountPerUnit !== null && p.access.fixedAmountPerUnit !== undefined
                ? `${Number(p.access.fixedAmountPerUnit).toFixed(2)} / وحدة`
                : null;
            return (
              <Card key={p.project.id} className="overflow-hidden flex flex-col">
                <div className="aspect-[16/9] bg-surface-muted overflow-hidden">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={tx(p.project.name)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-300">
                      <Building2 className="h-10 w-10" />
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 leading-tight">
                      {tx(p.project.name)}
                    </h3>
                    <ProjectStatusBadge status={p.project.status} />
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPinned className="h-3.5 w-3.5 text-slate-400" />
                    {p.project.city}
                  </p>

                  <div className="rounded-xl bg-surface-muted px-3 py-2.5 text-2xs text-slate-700 space-y-0.5">
                    <p>
                      <span className="text-slate-500">العمولة:</span>{' '}
                      {pct ?? fixed ?? <span className="text-slate-400">يستخدم الافتراضي</span>}
                    </p>
                    <p>
                      <span className="text-slate-500">سريان:</span>{' '}
                      {p.access.startsAt || p.access.endsAt
                        ? `${formatDate(p.access.startsAt)} → ${formatDate(p.access.endsAt)}`
                        : '—'}
                    </p>
                  </div>

                  <div className="mt-auto pt-2 flex justify-end">
                    <Link
                      href={`/portal/units?projectId=${p.project.id}` as never}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        rightIcon={<ArrowLeft className="h-3.5 w-3.5" />}
                      >
                        وحدات هذا المشروع
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
