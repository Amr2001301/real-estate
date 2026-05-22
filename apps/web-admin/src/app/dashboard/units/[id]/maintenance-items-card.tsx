import { Wrench } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenanceCategory, UnitMaintenanceItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { MaintenanceItemsManager } from './maintenance-items-manager';

// ADMIN-only card (the GET items route is ADMIN-gated). Rendered only for
// admins by the unit detail page.
export async function MaintenanceItemsCard({ unitId }: { unitId: string }) {
  const [itemsRes, catsRes] = await Promise.all([
    safe(api.get<UnitMaintenanceItem[]>(`/units/${unitId}/maintenance-items?includeInactive=true`)),
    safe(api.get<MaintenanceCategory[]>('/maintenance-categories')),
  ]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        <h2 className="text-base font-semibold text-slate-900 tracking-tight inline-flex items-center gap-1.5">
          <Wrench className="h-4 w-4 text-brand-500" /> عناصر الصيانة والضمان
        </h2>
      </div>
      <p className="mt-1.5 mb-4 text-xs text-slate-500">
        اختر العناصر التي تنطبق على هذه الوحدة. يبدأ الضمان تلقائياً عند توقيع عقد البيع.
      </p>

      {itemsRes.error ? (
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          تعذّر تحميل عناصر الصيانة: {itemsRes.error}
        </div>
      ) : (
        <MaintenanceItemsManager
          unitId={unitId}
          items={itemsRes.data ?? []}
          categories={catsRes.data ?? []}
        />
      )}
    </Card>
  );
}
