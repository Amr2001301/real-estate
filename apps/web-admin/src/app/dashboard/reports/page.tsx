import { api, safe } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface Sales {
  contracts: number;
  total: number | string;
  byProject?: Array<{ projectId: string; total: number; count: number }>;
}
interface Financial {
  deposits: number;
  verified: number;
  total: number | string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period = sp.period ?? new Date().toISOString().slice(0, 7);

  const [salesRes, financialRes, reservationsRes] = await Promise.all([
    safe(api.get<Sales>(`/reports/sales?period=${period}`)),
    safe(api.get<Financial>(`/reports/financial?period=${period}`)),
    safe(api.get<Record<string, number>>('/reports/reservations')),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <form className="flex gap-2 items-center">
          <label className="text-sm">الفترة:</label>
          <input
            name="period"
            type="month"
            defaultValue={period}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-800 text-white px-3 py-1.5 text-sm">تطبيق</button>
        </form>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="المبيعات" sub={`عقود ${salesRes.data?.contracts ?? 0}`}>
          {formatCurrency(salesRes.data?.total ?? 0)}
        </Card>
        <Card title="الدفعات المسجلة" sub={`من إجمالي ${financialRes.data?.deposits ?? 0}`}>
          {formatCurrency(financialRes.data?.total ?? 0)}
        </Card>
        <Card title="المتحقق منها" sub={`دفعة`}>
          {financialRes.data?.verified ?? 0}
        </Card>
      </section>

      {salesRes.data?.byProject && salesRes.data.byProject.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold mb-3">المبيعات حسب المشروع</h2>
          <ul className="text-sm space-y-1">
            {salesRes.data.byProject.map((p) => (
              <li key={p.projectId} className="flex justify-between border-b border-gray-100 py-1">
                <span className="font-mono text-xs text-gray-500">{p.projectId.slice(0, 8)}</span>
                <span>
                  {p.count} عقد · {formatCurrency(p.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">حالة الحجوزات</h2>
        <ul className="text-sm space-y-1">
          {Object.entries(reservationsRes.data ?? {}).map(([s, n]) => (
            <li key={s} className="flex justify-between border-b border-gray-100 py-1">
              <span className="font-mono">{s}</span>
              <span>{n}</span>
            </li>
          ))}
          {(!reservationsRes.data || Object.keys(reservationsRes.data).length === 0) && (
            <li className="text-xs text-gray-400">لا توجد بيانات</li>
          )}
        </ul>
      </section>

      {(salesRes.error || financialRes.error || reservationsRes.error) && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">
          {salesRes.error || financialRes.error || reservationsRes.error}
        </div>
      )}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-bold">{children}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
