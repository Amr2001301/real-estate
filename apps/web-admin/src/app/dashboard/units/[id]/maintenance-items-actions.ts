'use server';

import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';

export interface ItemFormState {
  error?: string;
  ok?: boolean;
}

// Select a maintenance category for this unit by creating a UnitMaintenanceItem.
// The item's display name is derived from the category (no manual warranty/
// supplier fields — warranty starts automatically on contract signing).
export async function selectCategoryAction(
  unitId: string,
  categoryId: string,
  ar: string,
  en: string,
): Promise<ItemFormState> {
  const res = await safe(
    api.post(`/units/${unitId}/maintenance-items`, { ar, en: en || ar, categoryId }),
  );
  if (res.error) return { error: res.error };
  revalidatePath(`/dashboard/units/${unitId}`);
  return { ok: true };
}

// Activate (reselect) or deactivate (unselect) an existing item. The backend
// rejects deactivating an item whose warranty has already started.
export async function setMaintenanceItemActiveAction(
  unitId: string,
  itemId: string,
  active: boolean,
): Promise<ItemFormState> {
  const res = await safe(api.patch(`/units/${unitId}/maintenance-items/${itemId}`, { active }));
  if (res.error) return { error: res.error };
  revalidatePath(`/dashboard/units/${unitId}`);
  return { ok: true };
}
