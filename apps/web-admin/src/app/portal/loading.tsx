import { PageHeaderSkeleton, KpiCardsSkeleton } from '@/components/ui/skeletons';

export default function PortalHomeLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />

      {/* Broker account strip */}
      <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />

      {/* 6 KPI cards */}
      <KpiCardsSkeleton count={6} />

      {/* Main grid: projects list + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
      </div>

      {/* Activity timeline */}
      <div className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  );
}
