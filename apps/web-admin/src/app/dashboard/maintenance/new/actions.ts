'use server';

import { redirect } from 'next/navigation';
import { api, safe } from '@/lib/api';
import type { Translatable, WarrantyStatus } from '@/lib/types';

export interface MaintenanceUnitOption {
  id: string;
  code: string;
  type: string;
  status: string;
  floor: number;
  building: { id: string; name: string } | null;
}

// A unit's selected maintenance item (category) offered when filing a request.
export interface MaintenanceItemOption {
  id: string;
  categoryId: string | null;
  name: Translatable;
  warrantyStatus: WarrantyStatus;
  warrantyStart: string | null;
  warrantyEnd: string | null;
}

// Fetch the units a customer owns through contracts. Returns a friendly Arabic
// error string instead of throwing so the client picker can render a banner.
export async function loadCustomerUnits(
  customerId: string,
): Promise<{ units: MaintenanceUnitOption[]; error: string | null }> {
  if (!customerId) return { units: [], error: null };
  const res = await safe(
    api.get<MaintenanceUnitOption[]>(`/customers/${customerId}/maintenance-units`),
  );
  if (res.error) return { units: [], error: 'تعذر تحميل وحدات العميل.' };
  return { units: res.data ?? [], error: null };
}

// Fetch a unit's active maintenance items (selected categories) for the request
// category picker. Only items with a category are usable.
export async function loadUnitItems(
  unitId: string,
): Promise<{ items: MaintenanceItemOption[]; error: string | null }> {
  if (!unitId) return { items: [], error: null };
  const res = await safe(api.get<MaintenanceItemOption[]>(`/units/${unitId}/maintenance-items`));
  if (res.error) return { items: [], error: 'تعذر تحميل عناصر صيانة الوحدة.' };
  return { items: (res.data ?? []).filter((i) => i.categoryId), error: null };
}

export async function createRequestAction(formData: FormData) {
  const assignedAdminId = String(formData.get('assignedAdminId') ?? '') || undefined;
  const categoryIds = formData.getAll('categoryIds').map(String).filter(Boolean);
  const res = await safe(
    api.post<{ id: string }>('/maintenance-requests', {
      customerId: String(formData.get('customerId') ?? ''),
      unitId: String(formData.get('unitId') ?? ''),
      categoryIds,
      description: String(formData.get('description') ?? ''),
      ...(assignedAdminId ? { assignedAdminId } : {}),
    }),
  );
  if (res.error) {
    redirect(`/dashboard/maintenance/new?err=${encodeURIComponent(res.error)}`);
  }
  redirect(res.data?.id ? `/dashboard/maintenance/${res.data.id}` : '/dashboard/maintenance');
}
