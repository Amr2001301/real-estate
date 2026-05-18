'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { AdminBrokerReservation } from '@/lib/types';

export interface AdminBrokerReservationFormState {
  error?: string;
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function int(formData: FormData, key: string): number | undefined {
  const s = str(formData, key);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : undefined;
}

export async function createAdminBrokerReservationAction(
  _prev: AdminBrokerReservationFormState,
  formData: FormData,
): Promise<AdminBrokerReservationFormState> {
  const brokerId = str(formData, 'brokerId');
  const leadId = str(formData, 'leadId');
  const unitId = str(formData, 'unitId');
  if (!brokerId) return { error: 'الوسيط مطلوب' };
  if (!leadId) return { error: 'الفرصة مطلوبة' };
  if (!unitId) return { error: 'الوحدة مطلوبة' };

  const payload = {
    brokerId,
    brokerAgentId: str(formData, 'brokerAgentId'),
    leadId,
    unitId,
    installmentPlanTemplateId: str(formData, 'installmentPlanTemplateId'),
    selectedDurationOptionId: str(formData, 'selectedDurationOptionId'),
    notes: str(formData, 'notes'),
    expiresInHours: int(formData, 'expiresInHours'),
  };

  let created: AdminBrokerReservation;
  try {
    created = await api.post<AdminBrokerReservation>('/broker-reservations', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/broker-reservations');
  revalidatePath(`/dashboard/broker-reservations/${created.id}`);
  redirect(`/dashboard/broker-reservations/${created.id}`);
}
