import Link from 'next/link';
import {
  Building2,
  MapPin,
  BadgePercent,
  CalendarRange,
  ArrowLeft,
  Home,
} from 'lucide-react';
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
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">المشاريع المتاحة</h2>
              <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {projects.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-hairline">
            {projects.map((p) => {
              const cover = p.project.media?.[0]?.url;
              const commissionPct =
                p.access.commissionPct !== null && p.access.commissionPct !== undefined
                  ? `${Number(p.access.commissionPct).toFixed(2)}%`
                  : null;
              const fixedAmount =
                p.access.fixedAmountPerUnit !== null && p.access.fixedAmountPerUnit !== undefined
                  ? `${Number(p.access.fixedAmountPerUnit).toLocaleString('ar-EG')} / وحدة`
                  : null;
              const hasDateRange = p.access.startsAt || p.access.endsAt;

              return (
                <div
                  key={p.project.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  {/* Thumbnail */}
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={tx(p.project.name)}
                      className="h-14 w-20 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-20 rounded-xl bg-gradient-to-br from-amber-50 to-brand-50 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-amber-300" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 truncate">{tx(p.project.name)}</h3>
                      <ProjectStatusBadge status={p.project.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                      <span className="flex items-center gap-1 text-slate-500">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        {p.project.city}
                      </span>
                      {(commissionPct ?? fixedAmount) && (
                        <span className="flex items-center gap-1 font-bold text-amber-700">
                          <BadgePercent className="h-3 w-3 text-amber-500 shrink-0" />
                          {commissionPct ?? fixedAmount}
                        </span>
                      )}
                      {!commissionPct && !fixedAmount && (
                        <span className="text-slate-400 text-2xs">نسبة الوساطة الافتراضية</span>
                      )}
                      {hasDateRange && (
                        <span className="flex items-center gap-1 text-slate-400 text-2xs" dir="ltr">
                          <CalendarRange className="h-3 w-3 shrink-0" />
                          <span className="tabular-nums">
                            {formatDate(p.access.startsAt)} – {formatDate(p.access.endsAt)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <Link
                    href={`/portal/units?projectId=${p.project.id}` as never}
                    className="shrink-0"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Home className="h-3.5 w-3.5" />}
                      rightIcon={<ArrowLeft className="h-3.5 w-3.5" />}
                    >
                      وحدات
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
