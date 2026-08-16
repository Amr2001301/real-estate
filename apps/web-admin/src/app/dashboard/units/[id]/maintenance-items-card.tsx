import { Wrench } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenanceCategory, UnitMaintenanceItem } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Card } from '@/components/ui/card';
import { MaintenanceItemsManager } from './maintenance-items-manager';

// ADMIN-only card (the GET items route is ADMIN-gated). Rendered only for
// admins by the unit detail page.
export async function MaintenanceItemsCard({ unitId, locale = 'ar' }: { unitId: string; locale?: Locale }) {
  const m = uiT(locale).pages.units.maintenanceCard;
  const [itemsRes, catsRes] = await Promise.all([
    safe(api.get<UnitMaintenanceItem[]>(`/units/${unitId}/maintenance-items?includeInactive=true`)),
    safe(api.get<MaintenanceCategory[]>('/maintenance-categories')),
  ]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        <h2 className="text-base font-semibold text-slate-900 tracking-tight inline-flex items-center gap-1.5">
          <Wrench className="h-4 w-4 text-brand-500" /> {m.title}
        </h2>
      </div>
      <p className="mt-1.5 mb-4 text-xs text-slate-500">
        {m.description}
      </p>

      {itemsRes.error ? (
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {m.errorLoad} {itemsRes.error}
        </div>
      ) : (
        <MaintenanceItemsManager
          unitId={unitId}
          items={itemsRes.data ?? []}
          categories={catsRes.data ?? []}
          locale={locale}
        />
      )}
    </Card>
  );
}
