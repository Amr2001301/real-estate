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
    <Card className="rounded-[22px] p-6">
      <h2 className="font-heading text-[19px] font-bold leading-snug text-slate-900">{m.title}</h2>
      <p className="mb-5 mt-0.5 text-[13px] text-slate-500">
        {m.description}
      </p>

      {itemsRes.error ? (
        <div className="rounded-xl bg-danger-500/10 text-danger-600 px-4 py-3 text-sm">
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
