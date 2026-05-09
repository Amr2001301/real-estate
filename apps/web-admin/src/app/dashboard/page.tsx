import { api, safe } from '@/lib/api';

interface Kpis {
  projects: number;
  units: { total: number; available: number; reserved: number; sold: number };
  leads: { total: number; new: number };
  pendingVisits: number;
  contracts: number;
  depositsTotal: number | string;
}

export default async function DashboardHome() {
  const r = await safe(api.get<Kpis>('/reports/kpis'));
  const kpis = r.data;
  const error = r.error;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">لوحة التحكم</h1>
      {error && (
        <div className="rounded-lg bg-amber-50 text-amber-800 p-4 mb-4">
          تعذر تحميل المؤشرات: {error}
        </div>
      )}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="المشاريع المنشورة" value={kpis.projects} />
          <KpiCard label="الوحدات المتاحة" value={kpis.units.available} sub={`من إجمالي ${kpis.units.total}`} />
          <KpiCard label="الوحدات المحجوزة" value={kpis.units.reserved} />
          <KpiCard label="الوحدات المباعة" value={kpis.units.sold} />
          <KpiCard label="إجمالي العملاء المحتملين" value={kpis.leads.total} sub={`جدد: ${kpis.leads.new}`} />
          <KpiCard label="زيارات قيد الانتظار" value={kpis.pendingVisits} />
          <KpiCard label="إجمالي العقود" value={kpis.contracts} />
          <KpiCard label="إجمالي الدفعات" value={String(kpis.depositsTotal)} />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
