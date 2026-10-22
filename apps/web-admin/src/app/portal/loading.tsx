export default function PortalHomeLoading() {
  return (
    <div className="space-y-4">
      {/* Compact hero header */}
      <div className="h-[76px] rounded-2xl shimmer" />

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[108px] rounded-2xl shimmer" />
        ))}
      </div>

      {/* Follow-ups + Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[220px] rounded-2xl shimmer" />
        <div className="h-[220px] rounded-2xl shimmer" />
      </div>

      {/* Leads table + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 h-[280px] rounded-2xl shimmer" />
        <div className="lg:col-span-4 space-y-4">
          <div className="h-[180px] rounded-2xl shimmer" />
          <div className="h-[180px] rounded-2xl shimmer" />
        </div>
      </div>

      {/* Activity feed */}
      <div className="h-[180px] rounded-2xl shimmer" />
    </div>
  );
}
