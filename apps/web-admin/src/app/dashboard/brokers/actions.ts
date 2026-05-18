'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  Broker,
  BrokerCommissionModel,
  BrokerStatus,
  BrokerUserStatus,
} from '@/lib/types';

export interface BrokerFormState {
  error?: string;
  ok?: boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function num(formData: FormData, key: string): number | undefined {
  const v = str(formData, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function date(formData: FormData, key: string): string | undefined {
  const v = str(formData, key);
  if (!v) return undefined;
  // <input type="date"> returns YYYY-MM-DD; promote to ISO datetime at UTC midnight.
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
}

function buildBrokerPayload(formData: FormData) {
  return {
    companyName: str(formData, 'companyName'),
    commercialName: str(formData, 'commercialName'),
    code: str(formData, 'code'),
    email: str(formData, 'email'),
    phone: str(formData, 'phone'),
    city: str(formData, 'city'),
    address: str(formData, 'address'),
    taxId: str(formData, 'taxId'),
    commercialRegistration: str(formData, 'commercialRegistration'),
    bankName: str(formData, 'bankName'),
    bankAccountName: str(formData, 'bankAccountName'),
    bankIban: str(formData, 'bankIban'),
    defaultCommissionPct: num(formData, 'defaultCommissionPct'),
    commissionModel: str(formData, 'commissionModel') as
      | BrokerCommissionModel
      | undefined,
    contractStartAt: date(formData, 'contractStartAt'),
    contractEndAt: date(formData, 'contractEndAt'),
    contractPdfUrl: str(formData, 'contractPdfUrl'),
    notes: str(formData, 'notes'),
  };
}

// ── broker CRUD ─────────────────────────────────────────────────────────────

export async function createBrokerAction(
  _prev: BrokerFormState,
  formData: FormData,
): Promise<BrokerFormState> {
  const payload = buildBrokerPayload(formData);
  if (!payload.companyName) {
    return { error: 'اسم الشركة مطلوب' };
  }
  let created: Broker;
  try {
    created = await api.post<Broker>('/brokers', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/brokers');
  redirect(`/dashboard/brokers/${created.id}`);
}

export async function updateBrokerAction(
  id: string,
  _prev: BrokerFormState,
  formData: FormData,
): Promise<BrokerFormState> {
  const payload = buildBrokerPayload(formData);
  try {
    await api.patch(`/brokers/${id}`, payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/brokers/${id}`);
  revalidatePath(`/dashboard/brokers/${id}/edit`);
  revalidatePath('/dashboard/brokers');
  return { ok: true };
}

export async function updateBrokerStatusAction(
  id: string,
  _prev: BrokerFormState,
  formData: FormData,
): Promise<BrokerFormState> {
  const status = str(formData, 'status') as BrokerStatus | undefined;
  const reason = str(formData, 'reason');
  if (!status) return { error: 'الحالة مطلوبة' };
  try {
    await api.patch(`/brokers/${id}/status`, { status, reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/brokers/${id}`);
  revalidatePath(`/dashboard/brokers/${id}/edit`);
  revalidatePath('/dashboard/brokers');
  return { ok: true };
}

// ── broker users ────────────────────────────────────────────────────────────

export interface BrokerUserFormState {
  error?: string;
  ok?: boolean;
}

export async function createBrokerUserAction(
  brokerId: string,
  _prev: BrokerUserFormState,
  formData: FormData,
): Promise<BrokerUserFormState> {
  const payload = {
    fullName: str(formData, 'fullName'),
    email: str(formData, 'email'),
    phone: str(formData, 'phone'),
    password: str(formData, 'password'),
    jobTitle: str(formData, 'jobTitle'),
    isPrimaryContact: bool(formData, 'isPrimaryContact'),
    canManageBrokerUsers: bool(formData, 'canManageBrokerUsers'),
    canViewCommissions: formData.get('canViewCommissions') === null
      ? true
      : bool(formData, 'canViewCommissions'),
  };
  if (!payload.fullName) return { error: 'الاسم الكامل مطلوب' };
  if (!payload.email && !payload.phone) {
    return { error: 'البريد الإلكتروني أو رقم الجوال مطلوب' };
  }
  try {
    await api.post(`/brokers/${brokerId}/users`, payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/brokers/${brokerId}/users`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
  return { ok: true };
}

export async function updateBrokerUserAction(
  brokerId: string,
  brokerUserId: string,
  formData: FormData,
) {
  const payload: Record<string, unknown> = {
    fullName: str(formData, 'fullName'),
    email: str(formData, 'email'),
    phone: str(formData, 'phone'),
    jobTitle: str(formData, 'jobTitle'),
  };
  // Tri-state booleans (only sent when toggled by the user).
  if (formData.has('isPrimaryContact')) {
    payload.isPrimaryContact = bool(formData, 'isPrimaryContact');
  }
  if (formData.has('canManageBrokerUsers')) {
    payload.canManageBrokerUsers = bool(formData, 'canManageBrokerUsers');
  }
  if (formData.has('canViewCommissions')) {
    payload.canViewCommissions = bool(formData, 'canViewCommissions');
  }
  await api.patch(`/broker-users/${brokerUserId}`, payload);
  revalidatePath(`/dashboard/brokers/${brokerId}/users`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
}

export async function setBrokerUserPrimaryAction(
  brokerId: string,
  brokerUserId: string,
) {
  await api.patch(`/broker-users/${brokerUserId}`, { isPrimaryContact: true });
  revalidatePath(`/dashboard/brokers/${brokerId}/users`);
}

export async function updateBrokerUserStatusAction(
  brokerId: string,
  brokerUserId: string,
  status: BrokerUserStatus,
) {
  await api.patch(`/broker-users/${brokerUserId}/status`, { status });
  revalidatePath(`/dashboard/brokers/${brokerId}/users`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
}

// ── broker access ───────────────────────────────────────────────────────────

export async function grantProjectAccessAction(
  brokerId: string,
  formData: FormData,
) {
  const projectId = str(formData, 'projectId');
  if (!projectId) throw new Error('المشروع مطلوب');
  const payload = {
    projectId,
    commissionPct: num(formData, 'commissionPct'),
    fixedAmountPerUnit: num(formData, 'fixedAmountPerUnit'),
    startsAt: date(formData, 'startsAt'),
    endsAt: date(formData, 'endsAt'),
    active: formData.has('active') ? bool(formData, 'active') : true,
  };
  await api.post(`/brokers/${brokerId}/access/projects`, payload);
  revalidatePath(`/dashboard/brokers/${brokerId}/access`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
}

export async function revokeProjectAccessAction(
  brokerId: string,
  projectId: string,
) {
  await api.delete(`/brokers/${brokerId}/access/projects/${projectId}`);
  revalidatePath(`/dashboard/brokers/${brokerId}/access`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
}

export async function grantUnitAccessAction(
  brokerId: string,
  formData: FormData,
) {
  const unitId = str(formData, 'unitId');
  if (!unitId) throw new Error('الوحدة مطلوبة');
  const payload = {
    unitId,
    active: formData.has('active') ? bool(formData, 'active') : true,
  };
  await api.post(`/brokers/${brokerId}/access/units`, payload);
  revalidatePath(`/dashboard/brokers/${brokerId}/access`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
}

export async function revokeUnitAccessAction(
  brokerId: string,
  unitId: string,
) {
  await api.delete(`/brokers/${brokerId}/access/units/${unitId}`);
  revalidatePath(`/dashboard/brokers/${brokerId}/access`);
  revalidatePath(`/dashboard/brokers/${brokerId}`);
}
