import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Contract } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';

export default async function InstallmentsPage() {
  const r = await safe(api.get<Paged<Contract>>('/contracts?pageSize=100'));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">خطط التقسيط</h1>
      <p className="text-sm text-gray-500 mb-6">
        خطط التقسيط ترتبط بكل عقد. اضغط على عقد لإنشاء خطة أو عرضها.
      </p>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>}

      {r.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {r.data.data.length === 0 && (
            <p className="text-sm text-gray-400">لا توجد عقود بعد</p>
          )}
          {r.data.data.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/contracts/${c.id}`}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition"
            >
              <div className="text-sm font-medium">{c.customer?.fullName ?? '—'}</div>
              <div className="text-xs text-gray-500 mt-1">عقد #{c.id.slice(0, 8)}</div>
              <div className="text-xs text-gray-500">الإجمالي: {formatCurrency(c.totalAmount)}</div>
              <div className="mt-2 text-xs">
                {c.installmentPlan ? (
                  <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                    خطة موجودة
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                    لا توجد خطة
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-400">{formatDate(c.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
